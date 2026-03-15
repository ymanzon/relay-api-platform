import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { ImportService } from './import.service';

@Controller('catalog/import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  /**
   * Import from OpenAPI 3.x or Swagger 2.x spec.
   * Body: { spec: object }  — pre-parsed JSON
   * OR:   { yaml: string }  — raw YAML text (parsed server-side)
   */
  @Post('openapi')
  async importOpenApi(@Body() body: { spec?: any; yaml?: string }) {
    let spec = body.spec;

    if (!spec && body.yaml) {
      try {
        // Minimal YAML → JS parser for common spec patterns
        // (avoids adding js-yaml dependency; handles standard OpenAPI YAML)
        spec = this.parseYaml(body.yaml);
      } catch (e: any) {
        throw new BadRequestException(`YAML parse error: ${e.message}`);
      }
    }

    if (!spec) throw new BadRequestException('Provide spec (JSON object) or yaml (string)');
    return this.importService.importOpenApi(spec);
  }

  /**
   * Lightweight YAML parser sufficient for OpenAPI specs.
   * For complex YAML with anchors/aliases the user should pass pre-parsed JSON.
   */
  private parseYaml(yaml: string): any {
    // Use JSON.parse if it looks like JSON accidentally sent as yaml
    const trimmed = yaml.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return JSON.parse(trimmed);
    }

    // Delegate to js-yaml if available at runtime, otherwise throw helpful error
    try {
      const jsYaml = require('js-yaml');
      return jsYaml.load(yaml);
    } catch {
      throw new BadRequestException(
        'YAML parsing requires js-yaml package. ' +
        'Run: npm install js-yaml — or send a pre-parsed JSON object in the "spec" field.'
      );
    }
  }
}
