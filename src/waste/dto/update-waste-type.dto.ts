import { PartialType } from '@nestjs/mapped-types';
import { CreateWasteTypeDto } from './create-waste-type.dto';

export class UpdateWasteTypeDto extends PartialType(CreateWasteTypeDto) {}
