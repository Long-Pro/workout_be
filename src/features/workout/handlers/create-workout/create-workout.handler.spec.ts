import { NotFoundException } from '@nestjs/common';
import { Module } from '@nestjs/common';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { ClsModule } from 'nestjs-cls';
import { PrismaService } from 'src/database/prisma.service';
import { CreateWorkoutCommand } from './create-workout.command';
import { CreateWorkoutHandler } from './create-workout.handler';
import { CreateWorkoutInput } from './create-workout.input';
import { WeightUnit } from '../../../../utils/weight';

const USER_ID = '10000000-0000-4000-8000-000000000001';
const SQUAT_ID = '20000000-0000-4000-8000-000000000001';
const BENCH_ID = '20000000-0000-4000-8000-000000000002';
const PERFORMED_AT = new Date('2026-07-23T02:00:00.000Z');

const prismaMock = {
  user: {
    findFirst: jest.fn<(args: unknown) => Promise<{ id: string } | null>>(),
  },
  exercise: {
    findMany: jest.fn<(args: unknown) => Promise<Array<{ id: string }>>>(),
  },
  workout: {
    create: jest.fn<(args: unknown) => Promise<unknown>>(),
  },
  $transaction:
    jest.fn<(fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>>(),
};
prismaMock.$transaction.mockImplementation((fn) => fn(prismaMock));

// Provides PrismaMock under the PrismaService token so ClsPluginTransactional can resolve it
@Module({
  providers: [{ provide: PrismaService, useValue: prismaMock }],
  exports: [PrismaService],
})
class PrismaMockModule {}

describe('CreateWorkoutHandler', () => {
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
  let module: TestingModule;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(PERFORMED_AT);
    jest.clearAllMocks();

    module = await Test.createTestingModule({
      imports: [
        ClsModule.forRoot({
          plugins: [
            new ClsPluginTransactional({
              imports: [PrismaMockModule],
              adapter: new TransactionalAdapterPrisma({
                prismaInjectionToken: PrismaService,
              }),
            }),
          ],
        }),
      ],
      providers: [CreateWorkoutHandler],
    }).compile();

    handler = module.get(CreateWorkoutHandler);
  });

  afterEach(async () => {
    jest.useRealTimers();
    await module.close();
  });

  it('creates an ordered workout and normalizes all weights to kilograms', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: USER_ID });
    prismaMock.exercise.findMany.mockResolvedValue([
      { id: SQUAT_ID },
      { id: BENCH_ID },
    ]);
    prismaMock.workout.create.mockResolvedValue({ id: 'workout-id' });

    await expect(
      handler.execute(new CreateWorkoutCommand(input)),
    ).resolves.toBe(true);

    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: { id: USER_ID, deletedAt: null },
      select: { id: true },
    });
    expect(prismaMock.exercise.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: [SQUAT_ID, BENCH_ID] },
        deletedAt: null,
      },
      select: { id: true },
    });
    expect(prismaMock.workout.create).toHaveBeenCalledWith({
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
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.exercise.findMany.mockResolvedValue([
      { id: SQUAT_ID },
      { id: BENCH_ID },
    ]);

    await expect(
      handler.execute(new CreateWorkoutCommand(input)),
    ).rejects.toThrow(new NotFoundException('User was not found'));
    expect(prismaMock.workout.create).not.toHaveBeenCalled();
  });

  it('throws when any requested exercise does not exist', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: USER_ID });
    prismaMock.exercise.findMany.mockResolvedValue([{ id: SQUAT_ID }]);

    await expect(
      handler.execute(new CreateWorkoutCommand(input)),
    ).rejects.toThrow(new NotFoundException('Some exercises were not found'));
    expect(prismaMock.workout.create).not.toHaveBeenCalled();
  });

  it('looks up duplicate exercise IDs only once', async () => {
    const duplicateExerciseInput: CreateWorkoutInput = {
      userId: USER_ID,
      exercises: [input.exercises[0], input.exercises[0]],
    };
    prismaMock.user.findFirst.mockResolvedValue({ id: USER_ID });
    prismaMock.exercise.findMany.mockResolvedValue([{ id: SQUAT_ID }]);
    prismaMock.workout.create.mockResolvedValue({ id: 'workout-id' });

    await expect(
      handler.execute(new CreateWorkoutCommand(duplicateExerciseInput)),
    ).resolves.toBe(true);

    expect(prismaMock.exercise.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: [SQUAT_ID] },
        deletedAt: null,
      },
      select: { id: true },
    });
  });

  it('propagates database failures instead of reporting success', async () => {
    const databaseError = new Error('database unavailable');
    prismaMock.user.findFirst.mockResolvedValue({ id: USER_ID });
    prismaMock.exercise.findMany.mockResolvedValue([
      { id: SQUAT_ID },
      { id: BENCH_ID },
    ]);
    prismaMock.workout.create.mockRejectedValue(databaseError);

    await expect(handler.execute(new CreateWorkoutCommand(input))).rejects.toBe(
      databaseError,
    );
  });
});
