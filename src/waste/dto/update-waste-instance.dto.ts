import { PartialType } from '@nestjs/mapped-types';
import { CreateWasteInstanceDto } from './create-waste-instance.dto';

export class UpdateWasteInstanceDto extends PartialType(CreateWasteInstanceDto) {}
