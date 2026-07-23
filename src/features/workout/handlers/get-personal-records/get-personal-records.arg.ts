import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsOptional, IsUUID } from 'class-validator';
import { WEIGHT_UNITS, WeightUnit } from '../../../../utils/weight';
import { IsAfterOrEqualTo } from 'src/validators/is-after-or-equal-to';

export class GetPersonalRecordsArg {
  @ApiProperty({ example: '10000000-0000-4000-8000-000000000001' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ example: '20000000-0000-4000-8000-000000000001' })
  @IsUUID()
  exerciseId!: string;

  @ApiPropertyOptional({ enum: WEIGHT_UNITS, default: WeightUnit.KG })
  @IsOptional()
  @IsIn(WEIGHT_UNITS)
  unit?: WeightUnit = WeightUnit.KG;

  @ApiPropertyOptional({
    description:
      'Inclusive UTC start of the window (ISO 8601). Omit for all-time records.',
    example: '2026-07-01T00:00:00.000Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({
    description:
      'Inclusive UTC end of the window (ISO 8601). Must be ≥ from when both are supplied.',
    example: '2026-07-31T23:59:59.999Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  @IsAfterOrEqualTo('from')
  to?: Date;
}
