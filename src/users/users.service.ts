import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User } from './models/user.model';
import * as bcrypt from 'bcrypt';
import type { CreateUserResponse } from './types/int.type';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User) private userModel: typeof User) {}

  async create(createUserDto: CreateUserDto): Promise<CreateUserResponse> {
    try {
      const hashedpassword = await bcrypt.hash(createUserDto.password, 10);
      createUserDto.password = hashedpassword;
      const user = await this.userModel.create(createUserDto as any);
      const userData: CreateUserResponse = {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        collectorId: user.collectorId,
        isActive: user.isActive,
      };
      return userData;
    } catch (error: any) {
      throw new InternalServerErrorException(`Failed to create user: ${error.message}`);
    }
  }

  async findAll(): Promise<User[]> {
    try {
      return await this.userModel.findAll({
        attributes: {
          exclude: ['password'],
        },
      });
    } catch (error: any) {
      throw new NotFoundException(`Failed to retrieve users: ${error.message}`);
    }
  }

  async findByEmail(email: string): Promise<User> {
    try {
      const user = await this.userModel.findOne({ 
        attributes: {
          exclude: ['password'],
        },
        where: { email } 
      });
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
      const user = await this.userModel.findByPk(id, {
        attributes: {
          exclude: ['password'],
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }
      return user;
    } catch (error: any) {
      throw new NotFoundException(`Failed to retrieve user: ${error.message}`);
    }
  } 
  

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User | string> {
    try {
      const user = await this.findOne(id);

      if (updateUserDto.password) {
        const hashedPassword = await bcrypt.hash(updateUserDto.password, 10);
        updateUserDto.password = hashedPassword;
      }
      
      await user.update(updateUserDto);
      return `User with ID ${id} has been updated successfully.`;
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
