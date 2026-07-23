import { CreateWorkoutHandler } from './create-workout/create-workout.handler';
import { GetWorkoutHistoryHandler } from './get-workout-history/get-workout-history.handler';

export const commandHandlers = [CreateWorkoutHandler];

export const queryHandlers = [GetWorkoutHistoryHandler];
