import { Module } from '@nestjs/common';
import { CaseService } from './case.service';
import { CaseController } from './case.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { Case } from './models/case.model';
import { ClassificationService } from './classification.service';

@Module({
  imports: [SequelizeModule.forFeature([Case])],
  controllers: [CaseController],
  providers: [CaseService, ClassificationService],
})
export class CaseModule {}
 