import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { WeightUnit, WEIGHT_UNITS } from '../../../../utils/weight';

export class CreateWorkoutSetInput {
  @ApiProperty({ example: 10, minimum: 1 })
  @IsInt()
  @Min(1)
  reps!: number;

  @ApiProperty({ example: 100.5, minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  weight!: number;

  @ApiProperty({ enum: WEIGHT_UNITS, example: 'kg' })
  @IsIn(WEIGHT_UNITS)
  unit!: WeightUnit;
}

export class CreateWorkoutExerciseInput {
  @ApiProperty({ example: '20000000-0000-4000-8000-000000000001' })
  @IsUUID()
  exerciseId!: string;

  @ApiProperty({ type: () => [CreateWorkoutSetInput] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkoutSetInput)
  sets!: CreateWorkoutSetInput[];
}

export class CreateWorkoutInput {
  @ApiProperty({ example: '10000000-0000-4000-8000-000000000001' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ type: () => [CreateWorkoutExerciseInput] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkoutExerciseInput)
  exercises!: CreateWorkoutExerciseInput[];
}
