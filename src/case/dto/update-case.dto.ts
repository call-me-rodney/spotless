import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsEnum, IsOptional, IsUUID } from '@nestjs/class-validator';
import { CreateCaseDto } from './create-case.dto';
import { Status, Priority } from '../types/enum.type';

// PartialType covers the citizen-supplied fields; the three below are the
// lifecycle fields a collector or admin sets after the case exists.
export class UpdateCaseDto extends PartialType(CreateCaseDto) {
    @IsOptional()
    @IsEnum(Status)
    declare status?: Status;

    @IsOptional()
    @IsEnum(Priority)
    declare priority?: Priority;

    @IsOptional()
    @IsBoolean()
    declare caseVerified?: boolean;

    // Dispatch: hand the case to a collector organisation.
    @IsOptional()
    @IsUUID()
    declare collectorId?: string;
}
