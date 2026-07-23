import { IQuery } from '@nestjs/cqrs';
import { GetPersonalRecordsArg } from './get-personal-records.arg';

export class GetPersonalRecordsQuery implements IQuery {
  constructor(public readonly arg: GetPersonalRecordsArg) {}
}
