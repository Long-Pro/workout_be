import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { DatabaseModule } from './database/database.module';
import { WorkoutModule } from './features/workout/workout.module';

@Module({
  imports: [DatabaseModule, CqrsModule.forRoot(), WorkoutModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
