import { WebSocketGateway, SubscribeMessage, MessageBody } from '@nestjs/websockets';
import { AnalyticsService } from './analytics.service';
import { CreateAnalyticsDto } from './dto/create-analytics.dto';
import { UpdateAnalyticsDto } from './dto/update-analytics.dto';

@WebSocketGateway()
export class AnalyticsGateway {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @SubscribeMessage('createAnalytics')
  create(@MessageBody() createAnalyticsDto: CreateAnalyticsDto) {
    return this.analyticsService.create(createAnalyticsDto);
  }

  @SubscribeMessage('findAllAnalytics')
  findAll() {
    return this.analyticsService.findAll();
  }

  @SubscribeMessage('findOneAnalytics')
  findOne(@MessageBody() id: number) {
    return this.analyticsService.findOne(id);
  }

  @SubscribeMessage('updateAnalytics')
  update(@MessageBody() updateAnalyticsDto: UpdateAnalyticsDto) {
    return this.analyticsService.update(updateAnalyticsDto.id, updateAnalyticsDto);
  }

  @SubscribeMessage('removeAnalytics')
  remove(@MessageBody() id: number) {
    return this.analyticsService.remove(id);
  }
}
