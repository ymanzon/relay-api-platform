import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ExecutionDocument = ApiExecution & Document;
export enum ExecutionStatus { SUCCESS = 'success', ERROR = 'error', TIMEOUT = 'timeout' }

@Schema({ timestamps: true })
export class ApiExecution {
  @Prop({ type: Types.ObjectId, ref: 'ApiEndpoint', required: true, index: true }) endpointId: Types.ObjectId;
  @Prop({ required: true }) endpointName: string;
  @Prop({ required: true }) virtualPath: string;
  @Prop({ required: true }) method: string;
  @Prop({ required: true, enum: ExecutionStatus }) status: ExecutionStatus;
  @Prop({ required: true }) mode: string;
  @Prop({ required: true }) startedAt: Date;
  @Prop({ required: true }) finishedAt: Date;
  @Prop({ required: true }) totalDurationMs: number;
  @Prop() proxyDurationMs?: number;
  @Prop({ type: Object }) requestQuery: Record<string, any>;
  @Prop({ type: Object }) requestBody: Record<string, any>;
  @Prop({ type: Object }) requestHeaders: Record<string, any>;
  @Prop() responseStatus: number;
  @Prop({ type: Object }) responseBody: any;
  @Prop({ type: [Object] }) preEventResults: any[];
  @Prop({ type: [Object] }) postEventResults: any[];
  @Prop({ type: Object }) ctxExtras: Record<string, any>;
  @Prop({ type: [String] }) validationErrors: string[];
  @Prop() errorMessage?: string;
  @Prop({ default: false }) apiKeyUsed?: boolean;
  @Prop({ default: false }) cacheHit?: boolean;
}

export const ApiExecutionSchema = SchemaFactory.createForClass(ApiExecution);
ApiExecutionSchema.index({ endpointId: 1, startedAt: -1 });
ApiExecutionSchema.index({ startedAt: -1 });
ApiExecutionSchema.index({ status: 1 });
