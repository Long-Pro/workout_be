import { Module } from '@nestjs/common';
import { WorkoutController } from './workout.controller';
import { CreateWorkoutHandler } from './handlers/create-workout/create-workout.handler';
import { commandHandlers, queryHandlers } from './handlers';

@Module({
  controllers: [WorkoutController],
  providers: [CreateWorkoutHandler, ...commandHandlers, ...queryHandlers],
})
export class WorkoutModule {}
