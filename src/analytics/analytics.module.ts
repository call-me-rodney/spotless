import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AnalyticsService } from './analytics.service';
import { AnalyticsGateway } from './analytics.gateway';
import { Case } from '../case/models/case.model';
import { Collector } from '../collectors/models/collector.model';
import { WasteInstance } from '../waste/models/wasteInstance.model';
import { WasteType } from '../waste/models/wasteType.model';
import { Routing } from '../routing/models/routing.model';

// Registers the MODELS it reads, not the modules that own them. forFeature can
// register the same model in several modules, so analytics stays a leaf of the
// dependency graph — it imports no domain module, and none imports it.
@Module({
  imports: [SequelizeModule.forFeature([Case, Collector, WasteInstance, WasteType, Routing])],
  providers: [AnalyticsGateway, AnalyticsService],
})
export class AnalyticsModule {}
