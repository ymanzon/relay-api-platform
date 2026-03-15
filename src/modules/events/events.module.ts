import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApiEvent, ApiEventSchema } from './schemas/event.schema';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ApiEvent.name, schema: ApiEventSchema }]),
  ],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
