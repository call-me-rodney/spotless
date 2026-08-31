import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CaseModule } from './case/case.module';
import { CollectorsModule } from './collectors/collectors.module';
import { RoutingModule } from './routing/routing.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { WasteModule } from './waste/waste.module';

@Module({
  imports: [
    SequelizeModule.forRoot({
      dialect: 'postgres',
      uri: 'postgresql://postgres:postgres@localhost:5432/spotless',
      // picks up every model registered via SequelizeModule.forFeature()
      autoLoadModels: true,
      // sync on boot; alter migrates existing tables to match the models
      synchronize: true,
      sync: { alter: true },
    }),
    AuthModule,
    UsersModule,
    CaseModule,
    CollectorsModule,
    RoutingModule,
    AnalyticsModule,
    WasteModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
