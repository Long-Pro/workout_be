import { Body, Controller, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CreateWorkoutInput } from './handlers/create-workout/create-workout.input';
import { CreateWorkoutCommand } from './handlers/create-workout/create-workout.command';

@ApiTags('workouts')
@Controller('workouts')
export class WorkoutController {
  constructor(
    private commandBus: CommandBus,
    private queryBus: QueryBus,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a workout' })
  @ApiBody({ type: CreateWorkoutInput })
  @ApiCreatedResponse({
    description: 'Workout created successfully',
    schema: {
      type: 'boolean',
      example: true,
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid workout data' })
  @ApiNotFoundResponse({ description: 'User or exercise not found' })
  create(@Body() input: CreateWorkoutInput) {
    return this.commandBus.execute(new CreateWorkoutCommand(input));
  }
}
