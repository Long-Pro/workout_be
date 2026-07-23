import { INestApplication, ValidationPipe } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Test } from '@nestjs/testing';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import request from 'supertest';
import { App } from 'supertest/types';
import { WorkoutController } from '../../workout.controller';
import { CreateWorkoutCommand } from './create-workout.command';
import { CreateWorkoutInput } from './create-workout.input';
import { WeightUnit } from '../../../../utils/weight';

const USER_ID = '10000000-0000-4000-8000-000000000001';
const EXERCISE_ID = '20000000-0000-4000-8000-000000000001';

describe('POST /workouts', () => {
  const commandBus = {
    execute: jest.fn<(command: unknown) => Promise<boolean>>(),
  };
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      controllers: [WorkoutController],
      providers: [
        { provide: CommandBus, useValue: commandBus },
        { provide: QueryBus, useValue: {} },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns true for a valid workout', async () => {
    commandBus.execute.mockResolvedValue(true);
    const input: CreateWorkoutInput = {
      userId: USER_ID,
      exercises: [
        {
          exerciseId: EXERCISE_ID,
          sets: [{ reps: 10, weight: 100.5, unit: WeightUnit.LB }],
        },
      ],
    };

    await request(app.getHttpServer())
      .post('/workouts')
      .send(input)
      .expect(201)
      .expect(({ text }) => {
        expect(text).toBe('true');
      });

    expect(commandBus.execute).toHaveBeenCalledWith(
      new CreateWorkoutCommand(input),
    );
  });

  it.each([
    ['an invalid user ID', { userId: 'not-a-uuid' }],
    ['an empty exercise list', { exercises: [] }],
    [
      'an unsupported unit',
      {
        exercises: [
          {
            exerciseId: EXERCISE_ID,
            sets: [{ reps: 10, weight: 100.5, unit: 'stone' }],
          },
        ],
      },
    ],
    [
      'zero reps',
      {
        exercises: [
          {
            exerciseId: EXERCISE_ID,
            sets: [{ reps: 0, weight: 100.5, unit: 'kg' }],
          },
        ],
      },
    ],
  ])('rejects %s', async (_caseName, override) => {
    const validInput = {
      userId: USER_ID,
      exercises: [
        {
          exerciseId: EXERCISE_ID,
          sets: [{ reps: 10, weight: 100.5, unit: 'kg' }],
        },
      ],
    };

    await request(app.getHttpServer())
      .post('/workouts')
      .send({ ...validInput, ...override })
      .expect(400);

    expect(commandBus.execute).not.toHaveBeenCalled();
  });
});
