import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsGateway } from './analytics.gateway';

// Analytics has no schema yet — re-add SequelizeModule.forFeature([Analytics])
// once analytics.model.ts defines a @Table (or drop it, if analytics stays derived).
@Module({
  providers: [AnalyticsGateway, AnalyticsService],
})
export class AnalyticsModule {}
