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
import { GetPersonalRecordsQuery } from './get-personal-records.query';
import { PersonalRecordsResponse } from './get-personal-records.response';
import { WeightUnit } from '../../../../utils/weight';

const USER_ID = '10000000-0000-4000-8000-000000000001';
const EXERCISE_ID = '20000000-0000-4000-8000-000000000001';

const EMPTY_RESPONSE: PersonalRecordsResponse = {
  exerciseId: EXERCISE_ID,
  exerciseName: 'Barbell Back Squat',
  muscleGroup: 'Legs',
  heaviestSet: null,
  highestVolumeSet: null,
  bestOneRepMax: null,
};

describe('GET /workouts/personal-records', () => {
  const queryBus = {
    execute: jest.fn<(query: unknown) => Promise<PersonalRecordsResponse>>(),
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

  it('dispatches a GetPersonalRecordsQuery with correct arg for a minimal valid request', async () => {
    queryBus.execute.mockResolvedValue(EMPTY_RESPONSE);

    await request(app.getHttpServer())
      .get('/workouts/personal-records')
      .query({ userId: USER_ID, exerciseId: EXERCISE_ID })
      .expect(200)
      .expect(EMPTY_RESPONSE);

    expect(queryBus.execute).toHaveBeenCalledTimes(1);
    const query = queryBus.execute.mock.calls[0][0];
    expect(query).toBeInstanceOf(GetPersonalRecordsQuery);
    expect((query as GetPersonalRecordsQuery).arg).toEqual(
      expect.objectContaining({
        userId: USER_ID,
        exerciseId: EXERCISE_ID,
        unit: WeightUnit.KG,
      }),
    );
  });

  it('forwards all optional parameters to the query', async () => {
    queryBus.execute.mockResolvedValue(EMPTY_RESPONSE);

    const from = '2026-07-01T00:00:00.000Z';
    const to = '2026-07-31T23:59:59.999Z';

    await request(app.getHttpServer())
      .get('/workouts/personal-records')
      .query({ userId: USER_ID, exerciseId: EXERCISE_ID, unit: 'lb', from, to })
      .expect(200);

    const query = queryBus.execute.mock.calls[0][0] as GetPersonalRecordsQuery;
    expect(query.arg).toEqual(
      expect.objectContaining({
        userId: USER_ID,
        exerciseId: EXERCISE_ID,
        unit: WeightUnit.LB,
        from: new Date(from),
        to: new Date(to),
      }),
    );
  });

  it.each([
    ['a missing userId', { exerciseId: EXERCISE_ID }],
    ['a missing exerciseId', { userId: USER_ID }],
    ['a non-UUID userId', { userId: 'not-a-uuid', exerciseId: EXERCISE_ID }],
    ['a non-UUID exerciseId', { userId: USER_ID, exerciseId: 'not-a-uuid' }],
    [
      'an unsupported unit',
      { userId: USER_ID, exerciseId: EXERCISE_ID, unit: 'stone' },
    ],
    [
      'an invalid from date',
      { userId: USER_ID, exerciseId: EXERCISE_ID, from: 'not-a-date' },
    ],
    [
      'an invalid to date',
      { userId: USER_ID, exerciseId: EXERCISE_ID, to: 'not-a-date' },
    ],
    [
      'a to that precedes from',
      {
        userId: USER_ID,
        exerciseId: EXERCISE_ID,
        from: '2026-08-01T00:00:00.000Z',
        to: '2026-07-01T00:00:00.000Z',
      },
    ],
  ])('rejects %s with 400', async (_caseName, query) => {
    await request(app.getHttpServer())
      .get('/workouts/personal-records')
      .query(query)
      .expect(400);

    expect(queryBus.execute).not.toHaveBeenCalled();
  });
});
