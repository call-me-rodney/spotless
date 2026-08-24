import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { RoutingService } from './routing.service';
import { CreateRoutingDto } from './dto/create-routing.dto';
import { UpdateRoutingDto } from './dto/update-routing.dto';

@Controller('routing')
export class RoutingController {
  constructor(private readonly routingService: RoutingService) {}

  @Post()
  create(@Body() createRoutingDto: CreateRoutingDto) {
    return this.routingService.create(createRoutingDto);
  }

  @Get()
  findAll() {
    return this.routingService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.routingService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRoutingDto: UpdateRoutingDto) {
    return this.routingService.update(+id, updateRoutingDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.routingService.remove(+id);
  }
}
