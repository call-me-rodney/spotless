import { PartialType } from '@nestjs/mapped-types';
import { CreateRoutingDto } from './create-routing.dto';

export class UpdateRoutingDto extends PartialType(CreateRoutingDto) {}
