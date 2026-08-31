import { IsEmail, IsOptional, IsString, IsUUID } from "@nestjs/class-validator"

export class CreateUserDto {
    @IsString()
    declare firstName: string;

    @IsString()
    declare lastName: string;

    @IsEmail()
    declare email: string;

    @IsString()
    declare role: string;

    @IsString()
    declare password: string;

    @IsOptional()
    @IsUUID()
    declare collectorId?: string;
}
