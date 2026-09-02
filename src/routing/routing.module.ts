import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { RoutingService } from './routing.service';
import { RoutingController } from './routing.controller';
import { Route } from './models/route.model';
import { RouteStop } from './models/routeStop.model';

@Module({
  imports: [SequelizeModule.forFeature([Route, RouteStop])],
  controllers: [RoutingController],
  providers: [RoutingService],
})
export class RoutingModule {}
