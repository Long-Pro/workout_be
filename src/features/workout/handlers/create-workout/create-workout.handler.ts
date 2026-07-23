import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from 'src/database/prisma.service';
import { CreateWorkoutCommand } from './create-workout.command';
import { convertWeight, WeightUnit } from '../../../../utils/weight';

@CommandHandler(CreateWorkoutCommand)
export class CreateWorkoutHandler implements ICommandHandler<CreateWorkoutCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: CreateWorkoutCommand) {
    const { input } = command;
    const { userId, exercises } = input;

    const uniqueExerciseIds = [
      ...new Set(exercises.map(({ exerciseId }) => exerciseId)),
    ];
    const [user, existingExercises] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: userId, deletedAt: null },
        select: { id: true },
      }),
      this.prisma.exercise.findMany({
        where: {
          id: {
            in: uniqueExerciseIds,
          },
          deletedAt: null,
        },
        select: { id: true },
      }),
    ]);
    if (!user) {
      throw new NotFoundException(`User was not found`);
    }
    if (existingExercises.length !== uniqueExerciseIds.length) {
      throw new NotFoundException(`Some exercises were not found`);
    }

    await this.prisma.workout.create({
      data: {
        userId,
        performedAt: new Date(),
        workoutExercises: {
          create: exercises.map((exercise, exerciseIndex) => ({
            exerciseId: exercise.exerciseId,
            order: exerciseIndex + 1,
            entries: {
              create: exercise.sets.map((set, setIndex) => ({
                order: setIndex + 1,
                reps: set.reps,
                normalizedWeightKg: convertWeight(
                  set.weight,
                  set.unit,
                  WeightUnit.KG,
                ),
                originalWeightValue: set.weight,
                originalWeightUnit: set.unit,
              })),
            },
          })),
        },
      },
    });

    return true;
  }
}
