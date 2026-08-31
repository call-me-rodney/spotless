import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from 'src/users/users.module'

// Auth has no schema yet — re-add SequelizeModule.forFeature([Auth]) once
// auth.model.ts defines a @Table (e.g. for the audit log).
@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
