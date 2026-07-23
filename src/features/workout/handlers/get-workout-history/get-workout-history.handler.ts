import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from 'src/database/prisma.service';
import { convertWeight, WeightUnit } from '../../../../utils/weight';
import { GetWorkoutHistoryQuery } from './get-workout-history.query';
import { WorkoutHistoryResponse } from './get-workout-history.response';
import { WorkoutWhereInput } from 'src/generated/prisma/models';

@QueryHandler(GetWorkoutHistoryQuery)
export class GetWorkoutHistoryHandler implements IQueryHandler<GetWorkoutHistoryQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute({
    arg,
  }: GetWorkoutHistoryQuery): Promise<WorkoutHistoryResponse> {
    const {
      userId,
      exerciseName,
      from,
      to,
      muscleGroup,
      unit = WeightUnit.KG,
      page = 1,
      limit = 20,
    } = arg;

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('User was not found');
    }

    const hasExerciseFilter = Boolean(exerciseName || muscleGroup);
    const exerciseWhere = {
      exercise: {
        deletedAt: null,
        ...(exerciseName && {
          name: { contains: exerciseName, mode: 'insensitive' as const },
        }),
        ...(muscleGroup && {
          muscleGroup: { equals: muscleGroup, mode: 'insensitive' as const },
        }),
      },
    };
    const where: WorkoutWhereInput = {
      userId,
      performedAt: {
        gte: from,
        lte: to,
      },
      ...(hasExerciseFilter && {
        workoutExercises: { some: exerciseWhere },
      }),
    };

    const [total, workouts] = await Promise.all([
      this.prisma.workout.count({ where }),
      this.prisma.workout.findMany({
        where,
        orderBy: [{ performedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          performedAt: true,
          workoutExercises: {
            where: exerciseWhere,
            orderBy: { order: 'asc' },
            select: {
              exerciseId: true,
              exercise: {
                select: { name: true, muscleGroup: true },
              },
              entries: {
                orderBy: { order: 'asc' },
                select: {
                  reps: true,
                  normalizedWeightKg: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      data: workouts.map((workout) => ({
        id: workout.id,
        performedAt: workout.performedAt,
        exercises: workout.workoutExercises.map((workoutExercise) => ({
          exerciseId: workoutExercise.exerciseId,
          exerciseName: workoutExercise.exercise.name,
          muscleGroup: workoutExercise.exercise.muscleGroup,
          sets: workoutExercise.entries.map((entry) => ({
            reps: entry.reps,
            weight: convertWeight(
              Number(entry.normalizedWeightKg),
              WeightUnit.KG,
              unit,
            ),
            unit,
          })),
        })),
      })),
      total,
      page,
      limit,
    };
  }
}
