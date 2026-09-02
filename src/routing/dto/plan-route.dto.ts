import { IsDateString, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from '@nestjs/class-validator';
import { MAX_STOPS_PER_ROUTE } from '../routing.config';

export class PlanRouteDto {
    @IsUUID()
    declare collectorId: string;

    @IsOptional()
    @IsString()
    declare name?: string;

    @IsOptional()
    @IsDateString()
    declare plannedFor?: string;

    // Supply these to skip geocoding entirely. Without them the collector's
    // address is resolved through OpenWeather at plan time.
    @IsOptional()
    @IsNumber()
    @Min(-90)
    @Max(90)
    declare originLatitude?: number;

    @IsOptional()
    @IsNumber()
    @Min(-180)
    @Max(180)
    declare originLongitude?: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(MAX_STOPS_PER_ROUTE)
    declare maxStops?: number;

    @IsOptional()
    @IsNumber()
    @Min(0.1)
    @Max(100)
    declare radiusKm?: number;
}
