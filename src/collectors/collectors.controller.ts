import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CollectorsService } from './collectors.service';
import { CreateCollectorDto } from './dto/create-collector.dto';
import { UpdateCollectorDto } from './dto/update-collector.dto';

@Controller('collectors')
export class CollectorsController {
  constructor(private readonly collectorsService: CollectorsService) {}

  @Post()
  create(@Body() createCollectorDto: CreateCollectorDto) {
    return this.collectorsService.create(createCollectorDto);
  }

  @Get()
  findAll() {
    return this.collectorsService.findAll();
  }

  // ids are UUIDs — the scaffold's `+id` coerced them to NaN.
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.collectorsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCollectorDto: UpdateCollectorDto) {
    return this.collectorsService.update(id, updateCollectorDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.collectorsService.remove(id);
  }
}
