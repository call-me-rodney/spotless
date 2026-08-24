import { IsEmail, IsOptional, IsString } from "@nestjs/class-validator"

export class CreateUserDto {
    @IsString()
    declare firstname: string;

    @IsString()
    declare lastname: string;

    @IsEmail()
    declare email: string;

    @IsString()
    declare role: string;

    @IsString()
    declare password: string;

    @IsOptional()
    @IsString()
    declare collector: string;
}
