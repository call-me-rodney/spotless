import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { WasteService } from './waste.service';
import { CreateWasteTypeDto } from './dto/create-waste-type.dto';
import { UpdateWasteTypeDto } from './dto/update-waste-type.dto';
import { CreateWasteInstanceDto } from './dto/create-waste-instance.dto';
import { UpdateWasteInstanceDto } from './dto/update-waste-instance.dto';

@Controller('waste')
export class WasteController {
  constructor(private readonly wasteService: WasteService) {}

  // ---- catalog: the waste types the platform recognises -----------------

  @Post('types')
  createType(@Body() createWasteTypeDto: CreateWasteTypeDto) {
    return this.wasteService.createType(createWasteTypeDto);
  }

  @Get('types')
  findAllTypes() {
    return this.wasteService.findAllTypes();
  }

  @Get('types/:id')
  findOneType(@Param('id') id: string) {
    return this.wasteService.findOneType(id);
  }

  @Patch('types/:id')
  updateType(@Param('id') id: string, @Body() updateWasteTypeDto: UpdateWasteTypeDto) {
    return this.wasteService.updateType(id, updateWasteTypeDto);
  }

  @Delete('types/:id')
  removeType(@Param('id') id: string) {
    return this.wasteService.removeType(id);
  }

  // ---- instances: what the CNN actually found in a case image -----------

  @Post('instances')
  createInstance(@Body() createDto: CreateWasteInstanceDto) {
    return this.wasteService.createInstance(createDto);
  }

  // Filters let the dashboards ask "what was found in this case?" and
  // "where has this waste type turned up?" without pulling the whole table.
  @Get('instances')
  findAllInstances(@Query('caseId') caseId?: string, @Query('wasteTypeId') wasteTypeId?: string) {
    return this.wasteService.findAllInstances({ caseId, wasteTypeId });
  }

  @Get('instances/:id')
  findOneInstance(@Param('id') id: string) {
    return this.wasteService.findOneInstance(id);
  }

  @Patch('instances/:id')
  updateInstance(@Param('id') id: string, @Body() updateDto: UpdateWasteInstanceDto) {
    return this.wasteService.updateInstance(id, updateDto);
  }

  @Delete('instances/:id')
  removeInstance(@Param('id') id: string) {
    return this.wasteService.removeInstance(id);
  }
}
