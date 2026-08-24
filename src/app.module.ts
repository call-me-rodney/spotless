import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { CaseModule } from './case/case.module';
import { CollectorsModule } from './collectors/collectors.module';
import { RoutingModule } from './routing/routing.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { WasteModule } from './waste/waste.module';

@Module({
  imports: [AuthModule, UserModule, CaseModule, CollectorsModule, RoutingModule, AnalyticsModule, WasteModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
