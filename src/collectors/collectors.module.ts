import { Module } from '@nestjs/common';
import { CollectorsService } from './collectors.service';
import { CollectorsController } from './collectors.controller';

@Module({
  controllers: [CollectorsController],
  providers: [CollectorsService],
})
export class CollectorsModule {}
