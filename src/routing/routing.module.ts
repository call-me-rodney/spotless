import { Module } from '@nestjs/common';
import { RoutingService } from './routing.service';
import { RoutingController } from './routing.controller';
import { Routing } from './models/routing.model';
import { SequelizeModule } from '@nestjs/sequelize';

@Module({
  imports: [SequelizeModule.forFeature([Routing])],
  controllers: [RoutingController],
  providers: [RoutingService],
})
export class RoutingModule {}
