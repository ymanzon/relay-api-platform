import { Module } from '@nestjs/common';
import { ProxyController } from './proxy.controller';
import { ProxyService } from './proxy.service';
import { EndpointsModule } from '../endpoints/endpoints.module';
import { EventsModule } from '../events/events.module';
import { ExecutionsModule } from '../executions/executions.module';
// SecretsModule is @Global — no need to import, just inject SecretsService

@Module({
  imports: [EndpointsModule, EventsModule, ExecutionsModule],
  controllers: [ProxyController],
  providers: [ProxyService],
})
export class ProxyModule {}
