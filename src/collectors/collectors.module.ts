import { Module } from '@nestjs/common';
import { CollectorsService } from './collectors.service';
import { CollectorsController } from './collectors.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { Collector } from './models/collector.model';

@Module({
  imports: [SequelizeModule.forFeature([Collector])],
  controllers: [CollectorsController],
  providers: [CollectorsService],
})
export class CollectorsModule {}
