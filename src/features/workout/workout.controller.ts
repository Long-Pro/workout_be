import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CreateWorkoutInput } from './handlers/create-workout/create-workout.input';
import { CreateWorkoutCommand } from './handlers/create-workout/create-workout.command';
import { GetWorkoutHistoryArg } from './handlers/get-workout-history/get-workout-history.arg';
import { GetWorkoutHistoryQuery } from './handlers/get-workout-history/get-workout-history.query';
import { WorkoutHistoryResponse } from './handlers/get-workout-history/get-workout-history.response';

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

  @Get('history')
  @ApiOperation({ summary: 'Get paginated workout history' })
  @ApiOkResponse({
    description:
      'Workout history in the requested unit. A range with no matches returns an empty data array.',
    type: WorkoutHistoryResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid filters, pagination, unit, or date range',
  })
  @ApiNotFoundResponse({ description: 'User not found' })
  getHistory(@Query() arg: GetWorkoutHistoryArg) {
    return this.queryBus.execute(new GetWorkoutHistoryQuery(arg));
  }
}
