import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EndpointDocument = ApiEndpoint & Document;

export enum HttpMethod {
  GET = 'GET', POST = 'POST', PUT = 'PUT', PATCH = 'PATCH', DELETE = 'DELETE',
}
export enum ParamType {
  STRING = 'string', NUMBER = 'number', BOOLEAN = 'boolean', OBJECT = 'object', ARRAY = 'array',
}

export class ParamConfig {
  @Prop({ required: true }) name: string;
  @Prop({ enum: ParamType, default: ParamType.STRING }) type: ParamType;
  @Prop({ default: false }) required: boolean;
  @Prop() defaultValue: string;
  @Prop() description: string;
  @Prop() example: string;
}

export class MockResponse {
  @Prop({ default: 200 })   statusCode: number;
  @Prop({ type: Object })   body: any;
  @Prop({ type: Object })   headers: Record<string, string>;
  @Prop({ default: 0 })     delayMs: number;
  @Prop()                   fileBase64: string;
  @Prop()                   fileName: string;
  @Prop()                   fileMimeType: string;
}

export class FileConfig {
  @Prop({ default: false })  enabled: boolean;
  @Prop({ default: 'upload' }) mode: string; // 'upload' | 'download' | 'both'
  @Prop({ default: 'file' }) fieldName: string;
  @Prop({ default: 10 })     maxSizeMb: number;
  @Prop({ type: [String], default: [] }) allowedMimeTypes: string[];
}

export class CacheConfig {
  @Prop({ default: false })  enabled: boolean;
  @Prop({ default: 60 })     ttlSeconds: number;
  @Prop({ default: false })  ignoreBody: boolean;
  @Prop({ default: false })  ignoreQuery: boolean;
}


export class RateLimitConfig {
  @Prop({ default: false })  enabled: boolean;
  @Prop({ default: 60 })     requests: number;
  @Prop({ default: 60 })     windowSecs: number;
  @Prop({ enum: ['ip','apikey','fingerprint','global'], default: 'ip' }) strategy: string;
  @Prop({ default: 0 })      blockDurationSecs: number;
}

export class SecurityConfig {
  @Prop({ default: false })  enabled: boolean;
  // Rate limit
  @Prop({ type: Object, default: () => ({ enabled: false, requests: 60, windowSecs: 60, strategy: 'ip', blockDurationSecs: 0 }) })
  rateLimit: RateLimitConfig;
  // IP control
  @Prop({ type: [String], default: [] }) ipAllowlist: string[];
  @Prop({ type: [String], default: [] }) ipBlocklist:  string[];
  // Fingerprinting
  @Prop({ default: false })  fingerprintEnabled: boolean;
  @Prop({ type: [String], default: [] }) fingerprintBlocklist: string[];
  // Threat detection
  @Prop({ default: false })  threatDetectionEnabled: boolean;
  // HMAC signing
  @Prop({ default: false })  hmacEnabled: boolean;
  @Prop()                    hmacSecret: string;
  @Prop({ default: 'X-Signature' }) hmacHeader: string;
  @Prop({ enum: ['sha256','sha512'], default: 'sha256' }) hmacAlgorithm: string;
  // Body size
  @Prop({ default: 0 })      maxBodySizeKb: number;
  // CORS
  @Prop({ default: false })  corsEnabled: boolean;
  @Prop({ type: [String], default: ['*'] }) corsOrigins: string[];
}

@Schema({ timestamps: true })
export class ApiEndpoint {
  @Prop({ required: true })  name: string;
  @Prop()                    description: string;
  @Prop({ required: true, unique: true }) virtualPath: string;
  @Prop({ required: true, enum: HttpMethod }) method: HttpMethod;
  @Prop()                    destinationUrl: string;
  @Prop({ type: Object })    destinationHeaders: Record<string, string>;
  @Prop({ default: 30000 })  timeoutMs: number;
  @Prop({ type: [Object] })  queryParams: ParamConfig[];
  @Prop({ type: [Object] })  bodyParams: ParamConfig[];
  @Prop({ type: Object })    mockResponse: MockResponse;
  @Prop({ type: Object, default: () => ({ enabled: false }) }) fileConfig: FileConfig;
  @Prop({ type: Object, default: () => ({ enabled: false }) }) cacheConfig: CacheConfig;
  @Prop({ type: [Types.ObjectId], ref: 'ApiEvent' }) preEvents: Types.ObjectId[];
  @Prop({ type: [Types.ObjectId], ref: 'ApiEvent' }) postEvents: Types.ObjectId[];
  @Prop({ default: false })  requireApiKey: boolean;
  @Prop()                    apiKey: string;
  @Prop({ default: 32 })     apiKeyLength: number;
  @Prop({ default: true })   enabled: boolean;
  @Prop({ default: false })  logRequests: boolean;
  @Prop({ default: [] })     tags: string[];
  /** Collection / folder name for grouping endpoints in the UI */
  @Prop({ default: '' })     collection: string;
  /** Display order within collection */
  @Prop({ default: 0 })      order: number;
  /** Security configuration: rate limiting, IP control, threat detection */
  @Prop({
    type: Object,
    default: () => ({
      enabled: false,
      rateLimit: { enabled: false, requests: 60, windowSecs: 60, strategy: 'ip', blockDurationSecs: 0 },
      ipAllowlist: [], ipBlocklist: [],
      fingerprintEnabled: false, fingerprintBlocklist: [],
      threatDetectionEnabled: false,
      hmacEnabled: false, hmacSecret: '', hmacHeader: 'X-Signature', hmacAlgorithm: 'sha256',
      maxBodySizeKb: 0,
      corsEnabled: false, corsOrigins: ['*'],
    }),
  }) securityConfig: SecurityConfig;
}

export const ApiEndpointSchema = SchemaFactory.createForClass(ApiEndpoint);
