import { Injectable, BadRequestException } from '@nestjs/common';
import { EndpointsService } from '../endpoints/endpoints.service';
import { ParamConfigDto } from '../endpoints/dto/create-endpoint.dto';

export interface ImportResult {
  created:  number;
  skipped:  number;
  errors:   { path: string; method: string; reason: string }[];
  endpoints: any[];
}

@Injectable()
export class ImportService {
  constructor(private readonly endpointsService: EndpointsService) {}

  async importOpenApi(spec: any): Promise<ImportResult> {
    this.validateSpec(spec);

    const result: ImportResult = { created: 0, skipped: 0, errors: [], endpoints: [] };
    const paths = spec.paths || {};
    const baseTitle = spec.info?.title || 'Imported';

    for (const [rawPath, pathItem] of Object.entries(paths as Record<string, any>)) {
      const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];

      for (const method of METHODS) {
        const operation = pathItem[method];
        if (!operation) continue;

        const virtualPath = this.toVirtualPath(rawPath);
        const httpMethod  = method.toUpperCase();

        try {
          // Map parameters
          const allParams: any[] = [
            ...(pathItem.parameters || []),
            ...(operation.parameters || []),
          ];

          const queryParams = allParams
            .filter(p => p.in === 'query')
            .map(p => ({
              name:        p.name,
              type:        this.mapType(p.schema?.type),
              required:    !!p.required,
              description: p.description || '',
              example:     p.example != null ? String(p.example) : (p.schema?.example != null ? String(p.schema.example) : ''),
            }));

          // Map request body
          const bodyParams: any[] = [];
          const requestBody = operation.requestBody;
          if (requestBody) {
            const content = requestBody.content || {};
            const jsonContent = content['application/json'] || content['*/*'] || Object.values(content)[0];
            const schema = jsonContent?.schema;
            if (schema) {
              const props = this.flattenSchema(schema, spec);
              for (const [name, prop] of Object.entries(props as Record<string, any>)) {
                bodyParams.push({
                  name,
                  type:        this.mapType(prop.type),
                  required:    (schema.required || []).includes(name),
                  description: prop.description || '',
                  example:     prop.example != null ? String(prop.example) : '',
                });
              }
            }
          }

          // Mock response from first success response
          let mockResponse: any = { statusCode: 200, body: { message: 'Mock response' } };
          const responses = operation.responses || {};
          for (const [code, resp] of Object.entries(responses as Record<string, any>)) {
            const statusCode = parseInt(code, 10);
            if (statusCode >= 200 && statusCode < 300) {
              const content = (resp as any).content || {};
              const jsonContent = content['application/json'] || Object.values(content)[0];
              if (jsonContent?.example) {
                mockResponse = { statusCode, body: jsonContent.example };
              } else if (jsonContent?.schema?.example) {
                mockResponse = { statusCode, body: jsonContent.schema.example };
              } else {
                mockResponse = { statusCode, body: this.generateExampleBody(jsonContent?.schema, spec) };
              }
              break;
            }
          }

          const dto = {
            name:        operation.summary || operation.operationId || `${httpMethod} ${rawPath}`,
            description: operation.description || '',
            virtualPath,
            method:      httpMethod as any,
            queryParams: ParamConfigDto as any,
            bodyParams,
            mockResponse,
            enabled:     true,
            tags:        operation.tags || [],
            collection:  (operation.tags?.[0] || '').substring(0, 40),
          };

          const created = await this.endpointsService.create(dto);
          result.created++;
          result.endpoints.push({ id: (created as any)._id, name: dto.name, method: httpMethod, virtualPath });

        } catch (err: any) {
          if (err.status === 409) {
            result.skipped++;
          } else {
            result.errors.push({ path: rawPath, method: httpMethod, reason: err.message });
          }
        }
      }
    }

    return result;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private validateSpec(spec: any): void {
    if (!spec || typeof spec !== 'object') {
      throw new BadRequestException('Invalid spec: must be a JSON/YAML object');
    }
    if (!spec.openapi && !spec.swagger) {
      throw new BadRequestException('Invalid spec: missing "openapi" or "swagger" field');
    }
    if (!spec.paths || !Object.keys(spec.paths).length) {
      throw new BadRequestException('Spec has no paths defined');
    }
  }

  /** Convert OpenAPI path like /users/{id} → users/:id (relay virtual path) */
  private toVirtualPath(path: string): string {
    return path
      .replace(/^\//, '')          // remove leading slash
      .replace(/\{([^}]+)\}/g, ':$1'); // {param} → :param
  }

  private mapType(type: string | undefined): string {
    switch (type) {
      case 'integer':
      case 'number':  return 'number';
      case 'boolean': return 'boolean';
      case 'array':   return 'array';
      case 'object':  return 'object';
      default:        return 'string';
    }
  }

  /** Resolve $ref and return top-level properties of a schema */
  private flattenSchema(schema: any, spec: any, depth = 0): Record<string, any> {
    if (!schema || depth > 3) return {};
    schema = this.resolveRef(schema, spec);
    if (schema.properties) return schema.properties;
    if (schema.allOf) {
      return schema.allOf.reduce((acc: any, s: any) => ({
        ...acc, ...this.flattenSchema(s, spec, depth + 1),
      }), {});
    }
    return {};
  }

  /** Resolve $ref pointer within the spec */
  private resolveRef(schema: any, spec: any): any {
    if (!schema?.$ref) return schema;
    const parts = schema.$ref.replace(/^#\//, '').split('/');
    let node = spec;
    for (const part of parts) {
      node = node?.[part];
      if (!node) return schema; // unresolvable ref
    }
    return node;
  }

  /** Generate a simple example body object from a schema */
  private generateExampleBody(schema: any, spec: any): any {
    if (!schema) return {};
    schema = this.resolveRef(schema, spec);
    if (schema.example != null) return schema.example;
    if (schema.type === 'array') return [this.generateExampleBody(schema.items, spec)];
    const props = this.flattenSchema(schema, spec);
    if (!Object.keys(props).length) return {};
    const body: any = {};
    for (const [k, p] of Object.entries(props as Record<string, any>)) {
      const resolved = this.resolveRef(p, spec);
      body[k] = resolved.example ?? this.typeDefault(resolved.type);
    }
    return body;
  }

  private typeDefault(type: string): any {
    switch (type) {
      case 'integer':
      case 'number':  return 0;
      case 'boolean': return false;
      case 'array':   return [];
      case 'object':  return {};
      default:        return '';
    }
  }
}
