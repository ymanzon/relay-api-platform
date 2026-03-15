import { IsString, IsOptional, IsEnum, IsBoolean, IsArray, IsNumber, IsObject } from 'class-validator';
import { HttpMethod, ParamType } from '../schemas/endpoint.schema';

export class ParamConfigDto {
  @IsString()                   name: string;
  @IsOptional() @IsEnum(ParamType) type?: ParamType;
  @IsOptional() @IsBoolean()    required?: boolean;
  @IsOptional() @IsString()     defaultValue?: string;
  @IsOptional() @IsString()     description?: string;
  @IsOptional() @IsString()     example?: string;
}

export class MockResponseDto {
  @IsOptional() @IsNumber()     statusCode?: number;
  @IsOptional()                 body?: any;
  @IsOptional() @IsObject()     headers?: Record<string, string>;
  @IsOptional() @IsNumber()     delayMs?: number;
  @IsOptional() @IsString()     fileBase64?: string;
  @IsOptional() @IsString()     fileName?: string;
  @IsOptional() @IsString()     fileMimeType?: string;
}

export class FileConfigDto {
  @IsOptional() @IsBoolean()    enabled?: boolean;
  @IsOptional() @IsString()     mode?: string;
  @IsOptional() @IsString()     fieldName?: string;
  @IsOptional() @IsNumber()     maxSizeMb?: number;
  @IsOptional() @IsArray()      allowedMimeTypes?: string[];
}

export class CacheConfigDto {
  @IsOptional() @IsBoolean()    enabled?: boolean;
  @IsOptional() @IsNumber()     ttlSeconds?: number;
  @IsOptional() @IsBoolean()    ignoreBody?: boolean;
  @IsOptional() @IsBoolean()    ignoreQuery?: boolean;
}

export class CreateEndpointDto {
  @IsString()                   name: string;
  @IsOptional() @IsString()     description?: string;
  @IsString()                   virtualPath: string;
  @IsEnum(HttpMethod)           method: HttpMethod;
  @IsOptional() @IsString()     destinationUrl?: string;
  @IsOptional() @IsObject()     destinationHeaders?: Record<string, string>;
  @IsOptional() @IsNumber()     timeoutMs?: number;
  @IsOptional() @IsArray()      queryParams?: ParamConfigDto[];
  @IsOptional() @IsArray()      bodyParams?: ParamConfigDto[];
  @IsOptional()                 mockResponse?: MockResponseDto;
  @IsOptional()                 fileConfig?: FileConfigDto;
  @IsOptional()                 cacheConfig?: CacheConfigDto;
  @IsOptional() @IsArray()      preEvents?: string[];
  @IsOptional() @IsArray()      postEvents?: string[];
  @IsOptional() @IsBoolean()    requireApiKey?: boolean;
  @IsOptional() @IsString()     apiKey?: string;
  @IsOptional() @IsNumber()     apiKeyLength?: number;
  @IsOptional() @IsBoolean()    enabled?: boolean;
  @IsOptional() @IsBoolean()    logRequests?: boolean;
  @IsOptional() @IsArray()      tags?: string[];
  @IsOptional() @IsString()     collection?: string;
  @IsOptional() @IsNumber()     order?: number;
  @IsOptional()                 securityConfig?: any;
}
