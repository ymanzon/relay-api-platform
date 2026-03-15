import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SecurityEventDocument = SecurityEvent & Document;

export enum SecurityEventType {
  RATE_LIMIT_EXCEEDED  = 'rate_limit_exceeded',
  IP_BLOCKED           = 'ip_blocked',
  IP_NOT_ALLOWED       = 'ip_not_allowed',
  THREAT_DETECTED      = 'threat_detected',
  FINGERPRINT_BLOCKED  = 'fingerprint_blocked',
  HMAC_INVALID         = 'hmac_invalid',
  BODY_TOO_LARGE       = 'body_too_large',
  CORS_REJECTED        = 'cors_rejected',
  SUSPICIOUS_PATTERN   = 'suspicious_pattern',
}

// NOTE: NOT capped — capped collections block individual deletes and some index types.
// TTL index auto-expires events after 7 days.
@Schema({ timestamps: true })
export class SecurityEvent {
  @Prop({ type: Types.ObjectId, ref: 'ApiEndpoint' }) endpointId: Types.ObjectId;
  @Prop() endpointName: string;
  @Prop() virtualPath:  string;
  @Prop({ required: true, enum: SecurityEventType }) type: SecurityEventType;
  @Prop({ required: true }) clientIp:    string;
  @Prop() fingerprint?: string;
  @Prop() userAgent?:   string;
  @Prop() apiKey?:      string;  // last 6 chars only
  @Prop() detail?:      string;
  @Prop({ type: Object }) requestMeta?: Record<string, any>;
  @Prop({ default: false }) blocked: boolean;
  @Prop() blockedUntil?: Date;
}

export const SecurityEventSchema = SchemaFactory.createForClass(SecurityEvent);

// TTL: auto-delete events older than 7 days
SecurityEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 3600 });

// Query indexes
SecurityEventSchema.index({ clientIp: 1, createdAt: -1 });
SecurityEventSchema.index({ endpointId: 1, createdAt: -1 });
SecurityEventSchema.index({ type: 1, createdAt: -1 });
