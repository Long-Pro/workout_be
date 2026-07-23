import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WeightUnit, WEIGHT_UNITS } from '../../../../utils/weight';

export class HeaviestSetResponse {
  @ApiProperty({ example: 5 })
  reps!: number;

  @ApiProperty({ example: 140.0 })
  weight!: number;

  @ApiProperty({ enum: WEIGHT_UNITS, example: 'kg' })
  unit!: WeightUnit;

  @ApiProperty({ example: '2026-07-23T02:00:00.000Z' })
  performedAt!: Date;
}

export class HighestVolumeSetResponse {
  @ApiProperty({ example: 10 })
  reps!: number;

  @ApiProperty({ example: 100.0 })
  weight!: number;

  @ApiProperty({ enum: WEIGHT_UNITS, example: 'kg' })
  unit!: WeightUnit;

  @ApiProperty({
    description: 'reps × weight in the requested unit',
    example: 1000.0,
  })
  volume!: number;

  @ApiProperty({ example: '2026-07-23T02:00:00.000Z' })
  performedAt!: Date;
}

export class BestOneRepMaxResponse {
  @ApiProperty({ example: 5 })
  reps!: number;

  @ApiProperty({ example: 140.0 })
  weight!: number;

  @ApiProperty({ enum: WEIGHT_UNITS, example: 'kg' })
  unit!: WeightUnit;

  @ApiProperty({
    description: 'Epley estimated 1RM: weight × (1 + reps / 30)',
    example: 163.333,
  })
  estimatedOneRepMax!: number;

  @ApiProperty({ example: '2026-07-23T02:00:00.000Z' })
  performedAt!: Date;
}

export class PersonalRecordsResponse {
  @ApiProperty({ example: '20000000-0000-4000-8000-000000000001' })
  exerciseId!: string;

  @ApiProperty({ example: 'Barbell Back Squat' })
  exerciseName!: string;

  @ApiPropertyOptional({ example: 'Legs', nullable: true })
  muscleGroup!: string | null;

  @ApiPropertyOptional({ type: () => HeaviestSetResponse, nullable: true })
  heaviestSet!: HeaviestSetResponse | null;

  @ApiPropertyOptional({ type: () => HighestVolumeSetResponse, nullable: true })
  highestVolumeSet!: HighestVolumeSetResponse | null;

  @ApiPropertyOptional({ type: () => BestOneRepMaxResponse, nullable: true })
  bestOneRepMax!: BestOneRepMaxResponse | null;
}
