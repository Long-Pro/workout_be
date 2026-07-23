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
import { GetWorkoutHistoryQuery } from './get-workout-history.query';
import { WorkoutHistoryResponse } from './get-workout-history.response';
import { WeightUnit } from '../../../../utils/weight';

const USER_ID = '10000000-0000-4000-8000-000000000001';
const DATE_QUERY = {
  from: '2026-07-01T00:00:00.000Z',
  to: '2026-07-31T23:59:59.999Z',
};

describe('GET /workouts/history', () => {
  const queryBus = {
    execute: jest.fn<(query: unknown) => Promise<WorkoutHistoryResponse>>(),
  };
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      controllers: [WorkoutController],
      providers: [
        { provide: CommandBus, useValue: {} },
        { provide: QueryBus, useValue: queryBus },
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

  it('returns filtered paginated history', async () => {
    const response: WorkoutHistoryResponse = {
      data: [],
      total: 0,
      page: 3,
      limit: 5,
    };
    queryBus.execute.mockResolvedValue(response);

    await request(app.getHttpServer())
      .get('/workouts/history')
      .query({
        userId: USER_ID,
        ...DATE_QUERY,
        exerciseName: 'squat',
        unit: WeightUnit.LB,
        page: 3,
        limit: 5,
      })
      .expect(200)
      .expect(response);

    expect(queryBus.execute).toHaveBeenCalledTimes(1);
    const query = queryBus.execute.mock.calls[0][0];
    expect(query).toBeInstanceOf(GetWorkoutHistoryQuery);
    expect((query as GetWorkoutHistoryQuery).arg).toEqual(
      expect.objectContaining({
        userId: USER_ID,
        from: new Date(DATE_QUERY.from),
        to: new Date(DATE_QUERY.to),
        exerciseName: 'squat',
        unit: WeightUnit.LB,
        page: 3,
        limit: 5,
      }),
    );
  });

  it.each([
    ['a missing user ID', { ...DATE_QUERY }],
    ['a missing start date', { userId: USER_ID, to: DATE_QUERY.to }],
    ['a missing end date', { userId: USER_ID, from: DATE_QUERY.from }],
    ['an unsupported unit', { userId: USER_ID, ...DATE_QUERY, unit: 'stone' }],
    ['an invalid date', { userId: USER_ID, ...DATE_QUERY, from: 'not-a-date' }],
    ['a non-positive page', { userId: USER_ID, ...DATE_QUERY, page: 0 }],
    ['an excessive limit', { userId: USER_ID, ...DATE_QUERY, limit: 101 }],
    [
      'an inverted date range',
      {
        userId: USER_ID,
        from: '2026-08-01T00:00:00.000Z',
        to: '2026-07-01T00:00:00.000Z',
      },
    ],
  ])('rejects %s', async (_caseName, query) => {
    await request(app.getHttpServer())
      .get('/workouts/history')
      .query(query)
      .expect(400);

    expect(queryBus.execute).not.toHaveBeenCalled();
  });
});
