import { Command } from '@nestjs/cqrs';
import { CreateWorkoutInput } from './create-workout.input';

export class CreateWorkoutCommand extends Command<boolean> {
  constructor(public readonly input: CreateWorkoutInput) {
    super();
  }
}
