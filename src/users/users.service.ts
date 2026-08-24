import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User } from './models/user.model';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User) private userModel: typeof User) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    try {
      const hashedpassword = await bcrypt.hash(createUserDto.password, 10);
      createUserDto.password = hashedpassword;
      const user = await this.userModel.create(createUserDto as any);
      return user;
    } catch (error: any) {
      throw new InternalServerErrorException(`Failed to create user: ${error.message}`);
    }
  }

  async findAll(): Promise<User[]> {
    try {
      return await this.userModel.findAll();
    } catch (error: any) {
      throw new NotFoundException(`Failed to retrieve users: ${error.message}`);
    }
  }

  async findByEmail(email: string): Promise<User> {
    try {
      const user = await this.userModel.findOne({ where: { email } });
      if (!user) {
        throw new NotFoundException('User not found');
      }
      return user;
    } catch (error: any) {
      throw new NotFoundException(`Failed to retrieve user: ${error.message}`);
    }
  }

  async findOne(id: string): Promise<User> {
    try {
      const user = await this.userModel.findByPk(id);
      if (!user) {
        throw new NotFoundException('User not found');
      }
      return user;
    } catch (error: any) {
      throw new NotFoundException(`Failed to retrieve user: ${error.message}`);
    }
  } 
  

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    try {
      const user = await this.findOne(id);
      return user.update(updateUserDto);
    } catch (error: any) {
      throw new InternalServerErrorException(`Failed to update user: ${error.message}`);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      const user = await this.findOne(id);
      await user.destroy();
    } catch (error: any) {
      throw new InternalServerErrorException(`Failed to remove user: ${error.message}`);
    }
  }
}
