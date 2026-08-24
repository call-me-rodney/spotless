import { Injectable } from '@nestjs/common';
import { CreateCollectorDto } from './dto/create-collector.dto';
import { UpdateCollectorDto } from './dto/update-collector.dto';

@Injectable()
export class CollectorsService {
  create(createCollectorDto: CreateCollectorDto) {
    return 'This action adds a new collector';
  }

  findAll() {
    return `This action returns all collectors`;
  }

  findOne(id: number) {
    return `This action returns a #${id} collector`;
  }

  update(id: number, updateCollectorDto: UpdateCollectorDto) {
    return `This action updates a #${id} collector`;
  }

  remove(id: number) {
    return `This action removes a #${id} collector`;
  }
}
