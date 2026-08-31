import { IsEnum, IsNotEmpty, IsOptional, IsString } from '@nestjs/class-validator';
import { hazardLevel } from '../types/enum.types';

// A waste type — the catalog entry. Only `name` is required, so the CNN's
// auto-create path can register a label it has never seen before.
export class CreateWasteTypeDto {
    @IsString()
    @IsNotEmpty()
    declare name: string;

    @IsOptional()
    @IsString()
    declare description?: string;

    @IsOptional()
    @IsString()
    declare material?: string;

    @IsOptional()
    @IsEnum(hazardLevel)
    declare hazardLevel?: hazardLevel;
}
