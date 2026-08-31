import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from '@nestjs/class-validator';

export class CreateCollectorDto {
    @IsString()
    @IsNotEmpty()
    declare name: string;

    @IsOptional()
    @IsString()
    declare address?: string;

    @IsOptional()
    @IsInt()
    @Min(0)
    declare employeeCount?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(5)
    declare averageRating?: number;
}
