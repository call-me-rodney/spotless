import { Injectable } from '@nestjs/common';
import { CreateRoutingDto } from './dto/create-routing.dto';
import { UpdateRoutingDto } from './dto/update-routing.dto';

@Injectable()
export class RoutingService {
  create(createRoutingDto: CreateRoutingDto) {
    return 'This action adds a new routing';
  }

  findAll() {
    return `This action returns all routing`;
  }

  findOne(id: number) {
    return `This action returns a #${id} routing`;
  }

  update(id: number, updateRoutingDto: UpdateRoutingDto) {
    return `This action updates a #${id} routing`;
  }

  remove(id: number) {
    return `This action removes a #${id} routing`;
  }
}
