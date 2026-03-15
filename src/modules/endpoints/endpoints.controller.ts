import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { EndpointsService } from './endpoints.service';
import { CreateEndpointDto } from './dto/create-endpoint.dto';
import { UpdateEndpointDto } from './dto/update-endpoint.dto';

@Controller('catalog/endpoints')
export class EndpointsController {
  constructor(private readonly endpointsService: EndpointsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateEndpointDto) { return this.endpointsService.create(dto); }

  @Get()
  findAll(@Query('enabled') enabled?: string, @Query('tags') tags?: string, @Query('collection') collection?: string) {
    const filters: any = {};
    if (enabled !== undefined) filters.enabled = enabled === 'true';
    if (tags) filters.tags = tags.split(',');
    if (collection !== undefined) filters.collection = collection;
    return this.endpointsService.findAll(filters);
  }

  @Get('stats')
  getStats() { return this.endpointsService.getStats(); }

  /** Returns all unique collection names */
  @Get('collections')
  getCollections() { return this.endpointsService.getCollections(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.endpointsService.findOne(id); }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEndpointDto) {
    return this.endpointsService.update(id, dto);
  }

  @Post(':id/generate-key')
  generateKey(@Param('id') id: string, @Body('length') length?: number) {
    return this.endpointsService.generateKeyForEndpoint(id, length);
  }

  /** Move multiple endpoints to a collection */
  @Put('bulk/collection')
  bulkSetCollection(@Body() body: { ids: string[]; collection: string }) {
    return this.endpointsService.bulkSetCollection(body.ids, body.collection);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) { return this.endpointsService.remove(id); }
}
