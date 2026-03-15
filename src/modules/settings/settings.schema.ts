import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SettingsDocument = AppSettings & Document;

export enum Theme {
  DARK      = 'dark',
  LIGHT     = 'light',
  MIDNIGHT  = 'midnight',
  FOREST    = 'forest',
  SOLARIZED = 'solarized',
}

@Schema({ timestamps: true })
export class AppSettings {
  @Prop({ default: 'global' })
  key: string; // singleton — always 'global'

  @Prop({ enum: Theme, default: Theme.DARK })
  theme: Theme;

  @Prop({ type: Object, default: {} })
  customVars: Record<string, string>;

  @Prop({ default: 200 })
  historyMaxRows: number;
}

export const AppSettingsSchema = SchemaFactory.createForClass(AppSettings);
AppSettingsSchema.index({ key: 1 }, { unique: true });
