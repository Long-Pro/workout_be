import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from 'src/database/prisma.service';
import { Prisma } from 'src/generated/prisma/client';
import { convertWeight, WeightUnit } from '../../../../utils/weight';
import { GetPersonalRecordsQuery } from './get-personal-records.query';
import {
  BestOneRepMaxResponse,
  HeaviestSetResponse,
  HighestVolumeSetResponse,
  PersonalRecordsResponse,
} from './get-personal-records.response';

type PrRawRow = {
  reps: number;
  normalized_weight_kg: string | number;
  performed_at: Date;
};

@QueryHandler(GetPersonalRecordsQuery)
export class GetPersonalRecordsHandler implements IQueryHandler<GetPersonalRecordsQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute({
    arg,
  }: GetPersonalRecordsQuery): Promise<PersonalRecordsResponse> {
    const { userId, exerciseId, unit = WeightUnit.KG, from, to } = arg;

    const [user, exercise] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: userId, deletedAt: null },
        select: { id: true },
      }),
      this.prisma.exercise.findFirst({
        where: { id: exerciseId, deletedAt: null },
        select: { id: true, name: true, muscleGroup: true },
      }),
    ]);

    if (!user) throw new NotFoundException('User was not found');
    if (!exercise) throw new NotFoundException('Exercise was not found');

    const fromFilter = from
      ? Prisma.sql`AND w.performed_at >= ${from}`
      : Prisma.empty;
    const toFilter = to
      ? Prisma.sql`AND w.performed_at <= ${to}`
      : Prisma.empty;

    const [heaviestRows, volumeRows, oneRmRows] = await Promise.all([
      this.prisma.$queryRaw<PrRawRow[]>(
        this.buildQuery(
          Prisma.sql`wee.normalized_weight_kg`,
          fromFilter,
          toFilter,
          userId,
          exerciseId,
        ),
      ),
      this.prisma.$queryRaw<PrRawRow[]>(
        this.buildQuery(
          Prisma.sql`(wee.reps * wee.normalized_weight_kg)`,
          fromFilter,
          toFilter,
          userId,
          exerciseId,
        ),
      ),
      this.prisma.$queryRaw<PrRawRow[]>(
        this.buildQuery(
          Prisma.sql`(wee.normalized_weight_kg * (1 + wee.reps::numeric / 30))`,
          fromFilter,
          toFilter,
          userId,
          exerciseId,
        ),
      ),
    ]);

    const toBaseSet = (row: PrRawRow): HeaviestSetResponse => ({
      reps: Number(row.reps),
      weight: convertWeight(
        Number(row.normalized_weight_kg),
        WeightUnit.KG,
        unit,
      ),
      unit,
      performedAt: row.performed_at,
    });

    const heaviestSet: HeaviestSetResponse | null = heaviestRows[0]
      ? toBaseSet(heaviestRows[0])
      : null;

    const highestVolumeSet: HighestVolumeSetResponse | null = volumeRows[0]
      ? (() => {
          const base = toBaseSet(volumeRows[0]);
          return {
            ...base,
            volume: Number((base.reps * base.weight).toFixed(3)),
          };
        })()
      : null;

    const bestOneRepMax: BestOneRepMaxResponse | null = oneRmRows[0]
      ? (() => {
          const base = toBaseSet(oneRmRows[0]);
          return {
            ...base,
            estimatedOneRepMax: Number(
              (base.weight * (1 + base.reps / 30)).toFixed(3),
            ),
          };
        })()
      : null;

    return {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      muscleGroup: exercise.muscleGroup,
      heaviestSet,
      highestVolumeSet,
      bestOneRepMax,
    };
  }

  private buildQuery(
    orderByExpr: Prisma.Sql,
    fromFilter: Prisma.Sql,
    toFilter: Prisma.Sql,
    userId: string,
    exerciseId: string,
  ): Prisma.Sql {
    return Prisma.sql`
      SELECT wee.reps, wee.normalized_weight_kg, w.performed_at
      FROM workout_exercise_entries wee
      JOIN workout_exercises we ON we.id = wee.workout_exercise_id
      JOIN workouts w ON w.id = we.workout_id
      WHERE w.user_id = ${userId}::uuid
        AND we.exercise_id = ${exerciseId}::uuid
        ${fromFilter}
        ${toFilter}
      ORDER BY ${orderByExpr} DESC
      LIMIT 1
    `;
  }
}
