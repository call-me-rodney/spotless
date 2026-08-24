import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsGateway } from './analytics.gateway';

@Module({
  providers: [AnalyticsGateway, AnalyticsService],
})
export class AnalyticsModule {}
