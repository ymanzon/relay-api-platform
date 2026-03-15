import { Controller, Get, Post, Put, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { EnvironmentsService } from './environments.service';

@Controller('catalog/environments')
export class EnvironmentsController {
  constructor(private readonly svc: EnvironmentsService) {}

  @Get()
  findAll() { return this.svc.findAll(); }

  @Get('active')
  getActive() { return this.svc.getActive(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.svc.findOne(id); }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: any) { return this.svc.create(body); }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) { return this.svc.update(id, body); }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) { return this.svc.remove(id); }

  /** Set one environment as active (deactivates all others) */
  @Post(':id/activate')
  activate(@Param('id') id: string) { return this.svc.setActive(id); }

  /** Deactivate all environments (no active env = no variable resolution) */
  @Post('deactivate-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  deactivateAll() { return this.svc.deactivateAll(); }

  /** Preview what a URL + headers would look like after resolution */
  @Post('preview')
  preview(@Body() body: { envId?: string; url: string; headers?: Record<string, string> }) {
    return this.svc.previewResolution(body.envId || null, {
      url: body.url,
      headers: body.headers || {},
    });
  }
}
