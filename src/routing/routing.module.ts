import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { RoutingService } from './routing.service';
import { RoutingController } from './routing.controller';
import { GeocodingService } from './geocoding.service';
import { OfflineRouteOptimizer } from './optimizers/offline.optimizer';
import { GoogleRoutesOptimizer } from './optimizers/googleRoutes.optimizer';
import { GoogleMatrixOptimizer } from './optimizers/googleMatrix.optimizer';
import { Route } from './models/route.model';
import { RouteStop } from './models/routeStop.model';
import { Case } from '../case/models/case.model';
import { Collector } from '../collectors/models/collector.model';

// Registers the models it reads directly, so routing imports no domain module.
@Module({
  imports: [SequelizeModule.forFeature([Route, RouteStop, Case, Collector])],
  controllers: [RoutingController],
  providers: [
    RoutingService,
    GeocodingService,
    OfflineRouteOptimizer,
    GoogleRoutesOptimizer,
    GoogleMatrixOptimizer,
  ],
})
export class RoutingModule {}
