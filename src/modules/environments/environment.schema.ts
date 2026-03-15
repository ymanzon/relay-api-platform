import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EnvironmentDocument = Environment & Document;

export class EnvVariable {
  @Prop({ required: true }) key:   string;
  @Prop({ default: '' })    value: string;
  @Prop({ default: '' })    description: string;
}

@Schema({ timestamps: true })
export class Environment {
  @Prop({ required: true, unique: true }) name: string;
  @Prop({ default: '' })                  description: string;
  @Prop({ type: [Object], default: [] })  variables: EnvVariable[];
  @Prop({ default: false })               isActive: boolean;
  @Prop({ default: '#6c63ff' })           color: string;   // UI accent color
}

export const EnvironmentSchema = SchemaFactory.createForClass(Environment);
EnvironmentSchema.index({ isActive: 1 });
