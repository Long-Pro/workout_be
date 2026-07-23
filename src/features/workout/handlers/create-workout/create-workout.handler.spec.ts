import { NotFoundException } from '@nestjs/common';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { PrismaService } from 'src/database/prisma.service';
import { CreateWorkoutCommand } from './create-workout.command';
import { CreateWorkoutHandler } from './create-workout.handler';
import { CreateWorkoutInput } from './create-workout.input';
import { WeightUnit } from '../../../../utils/weight';

const USER_ID = '10000000-0000-4000-8000-000000000001';
const SQUAT_ID = '20000000-0000-4000-8000-000000000001';
const BENCH_ID = '20000000-0000-4000-8000-000000000002';
const PERFORMED_AT = new Date('2026-07-23T02:00:00.000Z');

describe('CreateWorkoutHandler', () => {
  const prisma = {
    user: {
      findFirst: jest.fn<(args: unknown) => Promise<{ id: string } | null>>(),
    },
    exercise: {
      findMany: jest.fn<(args: unknown) => Promise<Array<{ id: string }>>>(),
    },
    workout: {
      create: jest.fn<(args: unknown) => Promise<unknown>>(),
    },
  };

  const input: CreateWorkoutInput = {
    userId: USER_ID,
    exercises: [
      {
        exerciseId: SQUAT_ID,
        sets: [
          { reps: 10, weight: 100, unit: WeightUnit.LB },
          { reps: 8, weight: 50.5, unit: WeightUnit.KG },
        ],
      },
      {
        exerciseId: BENCH_ID,
        sets: [{ reps: 5, weight: 120, unit: WeightUnit.KG }],
      },
    ],
  };

  let handler: CreateWorkoutHandler;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(PERFORMED_AT);
    jest.clearAllMocks();
    handler = new CreateWorkoutHandler(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates an ordered workout and normalizes all weights to kilograms', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: USER_ID });
    prisma.exercise.findMany.mockResolvedValue([
      { id: SQUAT_ID },
      { id: BENCH_ID },
    ]);
    prisma.workout.create.mockResolvedValue({ id: 'workout-id' });

    await expect(
      handler.execute(new CreateWorkoutCommand(input)),
    ).resolves.toBe(true);

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: USER_ID, deletedAt: null },
      select: { id: true },
    });
    expect(prisma.exercise.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: [SQUAT_ID, BENCH_ID] },
        deletedAt: null,
      },
      select: { id: true },
    });
    expect(prisma.workout.create).toHaveBeenCalledWith({
      data: {
        userId: USER_ID,
        performedAt: PERFORMED_AT,
        workoutExercises: {
          create: [
            {
              exerciseId: SQUAT_ID,
              order: 1,
              entries: {
                create: [
                  {
                    order: 1,
                    reps: 10,
                    normalizedWeightKg: 45.359,
                    originalWeightValue: 100,
                    originalWeightUnit: 'lb',
                  },
                  {
                    order: 2,
                    reps: 8,
                    normalizedWeightKg: 50.5,
                    originalWeightValue: 50.5,
                    originalWeightUnit: 'kg',
                  },
                ],
              },
            },
            {
              exerciseId: BENCH_ID,
              order: 2,
              entries: {
                create: [
                  {
                    order: 1,
                    reps: 5,
                    normalizedWeightKg: 120,
                    originalWeightValue: 120,
                    originalWeightUnit: 'kg',
                  },
                ],
              },
            },
          ],
        },
      },
    });
  });

  it('throws when the user does not exist and does not write a workout', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.exercise.findMany.mockResolvedValue([
      { id: SQUAT_ID },
      { id: BENCH_ID },
    ]);

    await expect(
      handler.execute(new CreateWorkoutCommand(input)),
    ).rejects.toThrow(new NotFoundException('User was not found'));
    expect(prisma.workout.create).not.toHaveBeenCalled();
  });

  it('throws when any requested exercise does not exist', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: USER_ID });
    prisma.exercise.findMany.mockResolvedValue([{ id: SQUAT_ID }]);

    await expect(
      handler.execute(new CreateWorkoutCommand(input)),
    ).rejects.toThrow(new NotFoundException('Some exercises were not found'));
    expect(prisma.workout.create).not.toHaveBeenCalled();
  });

  it('looks up duplicate exercise IDs only once', async () => {
    const duplicateExerciseInput: CreateWorkoutInput = {
      userId: USER_ID,
      exercises: [input.exercises[0], input.exercises[0]],
    };
    prisma.user.findFirst.mockResolvedValue({ id: USER_ID });
    prisma.exercise.findMany.mockResolvedValue([{ id: SQUAT_ID }]);
    prisma.workout.create.mockResolvedValue({ id: 'workout-id' });

    await expect(
      handler.execute(new CreateWorkoutCommand(duplicateExerciseInput)),
    ).resolves.toBe(true);

    expect(prisma.exercise.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: [SQUAT_ID] },
        deletedAt: null,
      },
      select: { id: true },
    });
  });

  it('propagates database failures instead of reporting success', async () => {
    const databaseError = new Error('database unavailable');
    prisma.user.findFirst.mockResolvedValue({ id: USER_ID });
    prisma.exercise.findMany.mockResolvedValue([
      { id: SQUAT_ID },
      { id: BENCH_ID },
    ]);
    prisma.workout.create.mockRejectedValue(databaseError);

    await expect(handler.execute(new CreateWorkoutCommand(input))).rejects.toBe(
      databaseError,
    );
  });
});
