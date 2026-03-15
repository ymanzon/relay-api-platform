import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EventDocument = ApiEvent & Document;

export enum EventType {
  WEBHOOK = 'webhook',
  SCRIPT = 'script',
}

@Schema({ timestamps: true })
export class ApiEvent {
  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop({ required: true, enum: EventType })
  type: EventType;

  @Prop()
  url: string; // for webhook type

  @Prop()
  method: string; // GET, POST, etc for webhook

  @Prop({ type: Object })
  headers: Record<string, string>; // custom headers for webhook

  @Prop()
  script: string; // JS code for script type

  @Prop({ default: true })
  enabled: boolean;
}

export const ApiEventSchema = SchemaFactory.createForClass(ApiEvent);
