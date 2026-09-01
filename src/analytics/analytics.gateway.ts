import { OnModuleInit } from '@nestjs/common';
import {
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AnalyticsService } from './analytics.service';

// The one event dashboards listen for.
export const SNAPSHOT_EVENT = 'analytics:snapshot';

// cors is wide open for local dashboard development — tighten to the real
// dashboard origin before this is exposed anywhere.
@WebSocketGateway({ cors: { origin: '*' } })
export class AnalyticsGateway implements OnGatewayConnection, OnModuleInit {
  @WebSocketServer()
  private server!: Server;

  constructor(private readonly analyticsService: AnalyticsService) {}

  // Subscribing here (rather than the service calling the gateway) keeps the
  // dependency pointing one way: gateway -> service, never back.
  onModuleInit(): void {
    this.analyticsService.snapshots$.subscribe((snapshot) => {
      this.server?.emit(SNAPSHOT_EVENT, snapshot);
    });
  }

  // A dashboard gets the current picture immediately, then only deltas as
  // writes happen — no polling.
  async handleConnection(client: Socket): Promise<void> {
    client.emit(SNAPSHOT_EVENT, await this.analyticsService.snapshot());
  }

  // Escape hatch for a client that reconnects and wants to resync at once.
  @SubscribeMessage('analytics:refresh')
  async refresh() {
    return { event: SNAPSHOT_EVENT, data: await this.analyticsService.snapshot() };
  }
}
