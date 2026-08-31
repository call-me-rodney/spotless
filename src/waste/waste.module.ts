import { Module } from '@nestjs/common';
import { WasteService } from './waste.service';
import { WasteController } from './waste.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { WasteType } from './models/wasteType.model';
import { WasteInstance } from './models/wasteInstance.model';

@Module({
  imports: [SequelizeModule.forFeature([WasteType,WasteInstance])],
  controllers: [WasteController],
  providers: [WasteService],
})
export class WasteModule {}
