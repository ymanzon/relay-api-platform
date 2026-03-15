import { Controller, Get, Post, Put, Delete, Param, Body, HttpCode } from '@nestjs/common';
import { SecretsService } from './secrets.service';

@Controller('catalog/secrets')
export class SecretsController {
  constructor(private readonly svc: SecretsService) {}

  @Get()
  findAll() { return this.svc.findAll(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.svc.findOne(id); }

  @Post()
  create(@Body() body: { name: string; value: string; description?: string; type?: string }) {
    return this.svc.create(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: { value?: string; description?: string; type?: string }) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) { return this.svc.remove(id); }

  /** Validate that all {{REF}} in provided strings resolve to existing secrets */
  @Post('validate-refs')
  validateRefs(@Body() body: { strings: string[] }) {
    return this.svc.validateRefs(body.strings || []);
  }
}
