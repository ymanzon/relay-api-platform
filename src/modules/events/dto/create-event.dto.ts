import { IsString, IsOptional, IsEnum, IsBoolean, IsObject } from 'class-validator';
import { EventType } from '../schemas/event.schema';

export class CreateEventDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(EventType)
  type: EventType;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @IsOptional()
  @IsString()
  script?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
