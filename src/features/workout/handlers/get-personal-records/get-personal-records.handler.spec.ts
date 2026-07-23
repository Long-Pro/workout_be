import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PrismaService } from 'src/database/prisma.service';
import { WeightUnit } from '../../../../utils/weight';
import { GetPersonalRecordsHandler } from './get-personal-records.handler';
import { GetPersonalRecordsQuery } from './get-personal-records.query';

const USER_ID = '10000000-0000-4000-8000-000000000001';
const EXERCISE_ID = '20000000-0000-4000-8000-000000000001';
const PERFORMED_AT = new Date('2026-07-23T02:00:00.000Z');

type PrRawRow = {
  reps: number;
  normalized_weight_kg: string | number;
  performed_at: Date;
};

describe('GetPersonalRecordsHandler', () => {
  const prisma = {
    user: {
      findFirst: jest.fn<(args: unknown) => Promise<{ id: string } | null>>(),
    },
    exercise: {
      findFirst: jest.fn<
        (args: unknown) => Promise<{
          id: string;
          name: string;
          muscleGroup: string | null;
        } | null>
      >(),
    },
    $queryRaw: jest.fn<(query: unknown) => Promise<PrRawRow[]>>(),
  };

  let handler: GetPersonalRecordsHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new GetPersonalRecordsHandler(prisma as unknown as PrismaService);
    prisma.user.findFirst.mockResolvedValue({ id: USER_ID });
    prisma.exercise.findFirst.mockResolvedValue({
      id: EXERCISE_ID,
      name: 'Barbell Back Squat',
      muscleGroup: 'Legs',
    });
    prisma.$queryRaw.mockResolvedValue([]);
  });

  it('returns all three PRs with correct values and unit conversion (lb)', async () => {
    // 100 kg heaviest, 80 kg × 10 reps = 800 volume, 90 kg × 5 reps best 1RM
    const heaviestRow: PrRawRow = {
      reps: 3,
      normalized_weight_kg: '100',
      performed_at: PERFORMED_AT,
    };
    const volumeRow: PrRawRow = {
      reps: 10,
      normalized_weight_kg: '80',
      performed_at: PERFORMED_AT,
    };
    const oneRmRow: PrRawRow = {
      reps: 5,
      normalized_weight_kg: '90',
      performed_at: PERFORMED_AT,
    };

    prisma.$queryRaw
      .mockResolvedValueOnce([heaviestRow]) // heaviest
      .mockResolvedValueOnce([volumeRow]) // volume
      .mockResolvedValueOnce([oneRmRow]); // 1RM

    const result = await handler.execute(
      new GetPersonalRecordsQuery({
        userId: USER_ID,
        exerciseId: EXERCISE_ID,
        unit: WeightUnit.LB,
      }),
    );

    expect(result.exerciseId).toBe(EXERCISE_ID);
    expect(result.exerciseName).toBe('Barbell Back Squat');
    expect(result.muscleGroup).toBe('Legs');

    // 100 kg → 220.462 lb
    expect(result.heaviestSet).toEqual({
      reps: 3,
      weight: 220.462,
      unit: WeightUnit.LB,
      performedAt: PERFORMED_AT,
    });

    // 80 kg → 176.37 lb; volume = 10 × 176.37 = 1763.7
    expect(result.highestVolumeSet).toEqual({
      reps: 10,
      weight: 176.37,
      unit: WeightUnit.LB,
      volume: Number((10 * 176.37).toFixed(3)),
      performedAt: PERFORMED_AT,
    });

    // 90 kg → 198.416 lb; 1RM = 198.416 × (1 + 5/30)
    const expected1RM = Number((198.416 * (1 + 5 / 30)).toFixed(3));
    expect(result.bestOneRepMax).toEqual({
      reps: 5,
      weight: 198.416,
      unit: WeightUnit.LB,
      estimatedOneRepMax: expected1RM,
      performedAt: PERFORMED_AT,
    });
  });

  it('returns all three PRs in kg without conversion', async () => {
    const row: PrRawRow = {
      reps: 5,
      normalized_weight_kg: 140,
      performed_at: PERFORMED_AT,
    };

    prisma.$queryRaw
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([row]);

    const result = await handler.execute(
      new GetPersonalRecordsQuery({
        userId: USER_ID,
        exerciseId: EXERCISE_ID,
        unit: WeightUnit.KG,
      }),
    );

    expect(result.heaviestSet).toEqual({
      reps: 5,
      weight: 140,
      unit: WeightUnit.KG,
      performedAt: PERFORMED_AT,
    });
    expect(result.highestVolumeSet).toEqual({
      reps: 5,
      weight: 140,
      unit: WeightUnit.KG,
      volume: 700,
      performedAt: PERFORMED_AT,
    });
    // Epley: 140 × (1 + 5/30) = 140 × 1.1667 ≈ 163.333
    expect(result.bestOneRepMax).toEqual({
      reps: 5,
      weight: 140,
      unit: WeightUnit.KG,
      estimatedOneRepMax: Number((140 * (1 + 5 / 30)).toFixed(3)),
      performedAt: PERFORMED_AT,
    });
  });

  it('returns null for all PR fields when no matching entries exist', async () => {
    // $queryRaw already defaults to [] in beforeEach
    const result = await handler.execute(
      new GetPersonalRecordsQuery({
        userId: USER_ID,
        exerciseId: EXERCISE_ID,
      }),
    );

    expect(result).toEqual({
      exerciseId: EXERCISE_ID,
      exerciseName: 'Barbell Back Squat',
      muscleGroup: 'Legs',
      heaviestSet: null,
      highestVolumeSet: null,
      bestOneRepMax: null,
    });
  });

  it('passes from/to filters so queries are scoped to the window', async () => {
    const from = new Date('2026-07-01T00:00:00.000Z');
    const to = new Date('2026-07-31T23:59:59.999Z');

    await handler.execute(
      new GetPersonalRecordsQuery({
        userId: USER_ID,
        exerciseId: EXERCISE_ID,
        from,
        to,
      }),
    );

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(3);
  });

  it('throws NotFoundException when the user does not exist', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      handler.execute(
        new GetPersonalRecordsQuery({
          userId: USER_ID,
          exerciseId: EXERCISE_ID,
        }),
      ),
    ).rejects.toThrow(new NotFoundException('User was not found'));

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the exercise does not exist', async () => {
    prisma.exercise.findFirst.mockResolvedValue(null);

    await expect(
      handler.execute(
        new GetPersonalRecordsQuery({
          userId: USER_ID,
          exerciseId: EXERCISE_ID,
        }),
      ),
    ).rejects.toThrow(new NotFoundException('Exercise was not found'));

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('exposes a null muscleGroup when the exercise has none', async () => {
    prisma.exercise.findFirst.mockResolvedValue({
      id: EXERCISE_ID,
      name: 'Pull-up',
      muscleGroup: null,
    });

    const result = await handler.execute(
      new GetPersonalRecordsQuery({ userId: USER_ID, exerciseId: EXERCISE_ID }),
    );

    expect(result.muscleGroup).toBeNull();
  });
});
