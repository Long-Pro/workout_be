import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PrismaService } from 'src/database/prisma.service';
import { GetWorkoutHistoryHandler } from './get-workout-history.handler';
import { GetWorkoutHistoryQuery } from './get-workout-history.query';
import { WeightUnit } from '../../../../utils/weight';

const USER_ID = '10000000-0000-4000-8000-000000000001';
const WORKOUT_ID = '30000000-0000-4000-8000-000000000001';
const EXERCISE_ID = '20000000-0000-4000-8000-000000000001';
const FROM = new Date('2026-07-01T00:00:00.000Z');
const TO = new Date('2026-07-31T23:59:59.999Z');

describe('GetWorkoutHistoryHandler', () => {
  const prisma = {
    user: {
      findFirst: jest.fn<(args: unknown) => Promise<{ id: string } | null>>(),
    },
    workout: {
      count: jest.fn<(args: unknown) => Promise<number>>(),
      findMany: jest.fn<(args: unknown) => Promise<unknown[]>>(),
    },
  };
  let handler: GetWorkoutHistoryHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new GetWorkoutHistoryHandler(prisma as unknown as PrismaService);
    prisma.user.findFirst.mockResolvedValue({ id: USER_ID });
    prisma.workout.count.mockResolvedValue(0);
    prisma.workout.findMany.mockResolvedValue([]);
  });

  it('filters, paginates, and converts normalized kilograms to pounds', async () => {
    const performedAt = new Date('2026-07-23T02:00:00.000Z');
    prisma.workout.count.mockResolvedValue(1);
    prisma.workout.findMany.mockResolvedValue([
      {
        id: WORKOUT_ID,
        performedAt,
        workoutExercises: [
          {
            exerciseId: EXERCISE_ID,
            exercise: {
              name: 'Barbell Back Squat',
              muscleGroup: 'Legs',
            },
            entries: [{ reps: 5, normalizedWeightKg: 45.359 }],
          },
        ],
      },
    ]);

    await expect(
      handler.execute(
        new GetWorkoutHistoryQuery({
          userId: USER_ID,
          exerciseName: 'squat',
          muscleGroup: 'legs',
          from: FROM,
          to: TO,
          unit: WeightUnit.LB,
          page: 3,
          limit: 5,
        }),
      ),
    ).resolves.toEqual({
      data: [
        {
          id: WORKOUT_ID,
          performedAt,
          exercises: [
            {
              exerciseId: EXERCISE_ID,
              exerciseName: 'Barbell Back Squat',
              muscleGroup: 'Legs',
              sets: [{ reps: 5, weight: 99.999, unit: 'lb' }],
            },
          ],
        },
      ],
      total: 1,
      page: 3,
      limit: 5,
    });

    const exerciseWhere = {
      exercise: {
        deletedAt: null,
        name: { contains: 'squat', mode: 'insensitive' },
        muscleGroup: { equals: 'legs', mode: 'insensitive' },
      },
    };
    const where = {
      userId: USER_ID,
      performedAt: {
        gte: new Date('2026-07-01T00:00:00.000Z'),
        lte: new Date('2026-07-31T23:59:59.999Z'),
      },
      workoutExercises: { some: exerciseWhere },
    };
    expect(prisma.workout.count).toHaveBeenCalledWith({ where });
    expect(prisma.workout.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where,
        skip: 10,
        take: 5,
        orderBy: [{ performedAt: 'desc' }, { id: 'desc' }],
      }),
    );
  });

  it('returns an empty page with default pagination and kilograms', async () => {
    await expect(
      handler.execute(
        new GetWorkoutHistoryQuery({ userId: USER_ID, from: FROM, to: TO }),
      ),
    ).resolves.toEqual({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
    });
  });

  it('throws when the user does not exist', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      handler.execute(
        new GetWorkoutHistoryQuery({ userId: USER_ID, from: FROM, to: TO }),
      ),
    ).rejects.toThrow(new NotFoundException('User was not found'));
    expect(prisma.workout.count).not.toHaveBeenCalled();
    expect(prisma.workout.findMany).not.toHaveBeenCalled();
  });
});
