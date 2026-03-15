import { IsString, IsOptional, IsEnum, IsBoolean, IsArray, IsNumber, IsObject } from 'class-validator';
import { HttpMethod, ParamType } from '../schemas/endpoint.schema';

export class UpdateEndpointDto {
  @IsOptional() @IsString()   name?: string;
  @IsOptional() @IsString()   description?: string;
  @IsOptional() @IsString()   virtualPath?: string;
  @IsOptional() @IsEnum(HttpMethod) method?: HttpMethod;
  @IsOptional() @IsString()   destinationUrl?: string;
  @IsOptional() @IsObject()   destinationHeaders?: Record<string, string>;
  @IsOptional() @IsNumber()   timeoutMs?: number;
  @IsOptional() @IsArray()    queryParams?: any[];
  @IsOptional() @IsArray()    bodyParams?: any[];
  @IsOptional()               mockResponse?: any;
  @IsOptional()               fileConfig?: any;
  @IsOptional()               cacheConfig?: any;
  @IsOptional() @IsArray()    preEvents?: string[];
  @IsOptional() @IsArray()    postEvents?: string[];
  @IsOptional() @IsBoolean()  requireApiKey?: boolean;
  @IsOptional() @IsString()   apiKey?: string;
  @IsOptional() @IsNumber()   apiKeyLength?: number;
  @IsOptional() @IsBoolean()  enabled?: boolean;
  @IsOptional() @IsBoolean()  logRequests?: boolean;
  @IsOptional() @IsArray()    tags?: string[];
  @IsOptional() @IsString()   collection?: string;
  @IsOptional() @IsNumber()   order?: number;
  @IsOptional()               securityConfig?: any;
}
