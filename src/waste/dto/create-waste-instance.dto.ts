import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Min } from '@nestjs/class-validator';

// The payload the ML service posts after classifying a case image.
// Identify the type by id when known, otherwise by the CNN's own label —
// WasteService resolves the label case-insensitively and registers it if new.
export class CreateWasteInstanceDto {
    @IsUUID()
    declare caseId: string;

    @IsOptional()
    @IsUUID()
    declare wasteTypeId?: string;

    @IsOptional()
    @IsString()
    declare wasteTypeName?: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    declare quantity?: number;

    @IsOptional()
    @IsDateString()
    declare date?: string;

    @IsOptional()
    @IsString()
    declare location?: string;
}
