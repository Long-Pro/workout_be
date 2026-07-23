import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WeightUnit, WEIGHT_UNITS } from '../../../../utils/weight';

export class WorkoutHistorySetResponse {
  @ApiProperty({ example: 10 })
  reps!: number;

  @ApiProperty({ example: 100.5 })
  weight!: number;

  @ApiProperty({ enum: WEIGHT_UNITS, example: 'kg' })
  unit!: WeightUnit;
}

export class WorkoutHistoryExerciseResponse {
  @ApiProperty({ example: '20000000-0000-4000-8000-000000000001' })
  exerciseId!: string;

  @ApiProperty({ example: 'Barbell Back Squat' })
  exerciseName!: string;

  @ApiPropertyOptional({ example: 'Legs', nullable: true })
  muscleGroup!: string | null;

  @ApiProperty({ type: () => [WorkoutHistorySetResponse] })
  sets!: WorkoutHistorySetResponse[];
}

export class WorkoutHistoryItemResponse {
  @ApiProperty({ example: '30000000-0000-4000-8000-000000000001' })
  id!: string;

  @ApiProperty({ example: '2026-07-23T02:00:00.000Z' })
  performedAt!: Date;

  @ApiProperty({ type: () => [WorkoutHistoryExerciseResponse] })
  exercises!: WorkoutHistoryExerciseResponse[];
}

export class WorkoutHistoryResponse {
  @ApiProperty({ type: () => [WorkoutHistoryItemResponse] })
  data!: WorkoutHistoryItemResponse[];

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;
}
