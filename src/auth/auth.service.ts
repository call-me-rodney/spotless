import { Injectable, NotFoundException } from '@nestjs/common';
import { LoginPayload } from './types/int.type';
import { UsersService } from 'src/users/users.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  async login(loginPayload: LoginPayload): Promise<any> {
    try {
      const user = await this.usersService.findByEmail(loginPayload.email);
      if (!user) {
        throw new NotFoundException('User not found');
      }
      const isMatch = await bcrypt.compare(loginPayload.password, user.password);
      if (!isMatch) {
        throw new NotFoundException('Invalid password');
      }
      return user;
    } catch (error: any) {
      throw new NotFoundException(`Failed to login: ${error.message}`);
    }
  }

  // findAll() {
  //   return `This action returns all auth`;
  // }

  // findOne(id: number) {
  //   return `This action returns a #${id} auth`;
  // }

  // update(id: number, updateAuthDto: UpdateAuthDto) {
  //   return `This action updates a #${id} auth`;
  // }

  // remove(id: number) {
  //   return `This action removes a #${id} auth`;
  // }
}
