import { IsDateString, IsLatitude, IsLongitude, IsOptional, IsString, IsUUID } from '@nestjs/class-validator';

// NOTE: these decorators are inert until a ValidationPipe is wired up in main.ts
// (see CaseService, which coerces and range-checks these fields by hand).
// Fields arrive as strings because POST /case is multipart/form-data.
export class CreateCaseDto {
    @IsLatitude()
    declare latitude: string;

    @IsLongitude()
    declare longitude: string;

    @IsUUID()
    declare reporterId: string;

    @IsOptional()
    @IsDateString()
    declare timeTaken?: string;

    @IsOptional()
    @IsString()
    declare description?: string;
}
