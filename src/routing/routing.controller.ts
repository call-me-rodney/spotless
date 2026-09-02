import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { RoutingService } from './routing.service';
import { PlanRouteDto } from './dto/plan-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';

@Controller('routing')
export class RoutingController {
  constructor(private readonly routingService: RoutingService) {}

  // Select nearby open+verified cases, order them, and persist the plan.
  @Post('plan')
  plan(@Body() planRouteDto: PlanRouteDto) {
    return this.routingService.plan(planRouteDto);
  }

  @Get()
  findAll(@Query('collectorId') collectorId?: string) {
    return this.routingService.findAll(collectorId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.routingService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRouteDto: UpdateRouteDto) {
    return this.routingService.update(id, updateRouteDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.routingService.remove(id);
  }
}
