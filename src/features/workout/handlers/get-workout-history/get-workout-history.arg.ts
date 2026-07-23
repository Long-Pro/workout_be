import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { WEIGHT_UNITS, WeightUnit } from '../../../../utils/weight';
import { IsAfterOrEqualTo } from 'src/validators/is-after-or-equal-to';

export class GetWorkoutHistoryArg {
  @ApiProperty({ example: '10000000-0000-4000-8000-000000000001' })
  @IsUUID()
  userId!: string;

  @ApiPropertyOptional({
    description: 'Case-insensitive partial exercise name',
    example: 'squat',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  exerciseName?: string;

  @ApiProperty({
    description: 'Inclusive UTC start time (ISO 8601)',
    example: '2026-07-01T00:00:00.000Z',
  })
  @Type(() => Date)
  @IsDate()
  from!: Date;

  @ApiProperty({
    description: 'Inclusive UTC end time (ISO 8601)',
    example: '2026-07-31T23:59:59.999Z',
  })
  @Type(() => Date)
  @IsDate()
  @IsAfterOrEqualTo('from')
  to!: Date;

  @ApiPropertyOptional({ example: 'Legs' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  muscleGroup?: string;

  @ApiPropertyOptional({ enum: WEIGHT_UNITS, default: WeightUnit.KG })
  @IsOptional()
  @IsIn(WEIGHT_UNITS)
  unit?: WeightUnit = WeightUnit.KG;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
