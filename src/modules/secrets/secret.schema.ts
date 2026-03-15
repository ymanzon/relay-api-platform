import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SecretDocument = Secret & Document;

@Schema({ timestamps: true })
export class Secret {
  /** Nombre único en UPPER_SNAKE_CASE. Usado como referencia: {{SECRET_NAME}} */
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  name: string;

  @Prop({ trim: true })
  description?: string;

  /** Tipo visual para la UI */
  @Prop({ enum: ['api_key', 'token', 'password', 'oauth_secret', 'certificate', 'other'], default: 'other' })
  type: string;

  /** Valor cifrado (AES-256-GCM) — NUNCA se devuelve en respuestas */
  @Prop({ required: true })
  encryptedValue: string;

  /** Initialization Vector (hex) */
  @Prop({ required: true })
  iv: string;

  /** Auth tag (hex) para validar integridad */
  @Prop({ required: true })
  authTag: string;

  /** Cantidad de veces que fue resuelto durante ejecuciones de proxy */
  @Prop({ default: 0 })
  usageCount: number;

  /** Última vez que fue resuelto */
  @Prop()
  lastUsedAt?: Date;

  /** IDs de endpoints que lo referencian (se actualiza en save de endpoint) */
  @Prop({ type: [String], default: [] })
  referencedBy: string[];
}

export const SecretSchema = SchemaFactory.createForClass(Secret);
