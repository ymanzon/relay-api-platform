import { Controller, Get, Delete, Param, Query, Body } from '@nestjs/common';
import { ExecutionsService } from './executions.service';

@Controller('catalog/executions')
export class ExecutionsController {
  constructor(private readonly svc: ExecutionsService) {}

  @Get()
  findRecent(@Query('limit') limit?: string, @Query('range') range?: string, @Query('endpointId') endpointId?: string, @Query('since') since?: string) {
    return this.svc.findRecent({ limit: parseInt(limit || '200'), range: range || 'all', endpointId, since });
  }

  @Get('stats')
  globalStats(@Query('range') range?: string) { return this.svc.globalStats(range || 'all'); }

  @Get('endpoint/:id')
  findByEndpoint(@Param('id') id: string, @Query('limit') limit?: string, @Query('range') range?: string) {
    return this.svc.findByEndpoint(id, parseInt(limit || '100'), range || 'all');
  }

  @Get('endpoint/:id/stats')
  endpointStats(@Param('id') id: string, @Query('range') range?: string) {
    return this.svc.endpointStats(id, range || '1h');
  }

  @Delete('bulk')
  deleteBulk(@Body() body: { ids?: string[]; range?: string; endpointId?: string; status?: string }) {
    return this.svc.deleteBulk(body).then(n => ({ deleted: n }));
  }

  @Delete('endpoint/:id')
  clearByEndpoint(@Param('id') id: string) {
    return this.svc.deleteByEndpoint(id).then(() => ({ deleted: true }));
  }

  @Delete(':id')
  deleteOne(@Param('id') id: string) {
    return this.svc.deleteById(id).then(() => ({ deleted: true }));
  }
}
