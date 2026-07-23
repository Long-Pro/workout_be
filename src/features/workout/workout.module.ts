import { Module } from '@nestjs/common';
import { WorkoutController } from './workout.controller';
import { commandHandlers, queryHandlers } from './handlers';

@Module({
  controllers: [WorkoutController],
  providers: [...commandHandlers, ...queryHandlers],
})
export class WorkoutModule {}
