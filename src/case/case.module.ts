import { Module } from '@nestjs/common';
import { CaseService } from './case.service';
import { CaseController } from './case.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { Case } from './models/case.model';

@Module({
  imports: [SequelizeModule.forFeature([Case])],
  controllers: [CaseController],
  providers: [CaseService],
})
export class CaseModule {}
 