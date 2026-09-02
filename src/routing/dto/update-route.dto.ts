import { IsEnum, IsOptional, IsString } from '@nestjs/class-validator';
import { RouteStatus } from '../types/enum.type';

// A planned route's stops are not edited piecemeal — re-plan instead. Only the
// label and the lifecycle move by hand.
export class UpdateRouteDto {
    @IsOptional()
    @IsString()
    declare name?: string;

    @IsOptional()
    @IsEnum(RouteStatus)
    declare status?: RouteStatus;
}
