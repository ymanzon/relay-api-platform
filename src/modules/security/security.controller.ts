import { Controller, Get, Delete, Param, Query, Body, Post } from '@nestjs/common';
import { SecurityService } from './security.service';

@Controller('catalog/security')
export class SecurityController {
  constructor(private readonly svc: SecurityService) {}

  /** Recent security events for dashboard */
  @Get('events')
  getEvents(@Query('limit') limit?: string) {
    return this.svc.getRecentEvents(parseInt(limit || '100', 10));
  }

  /** Events by endpoint */
  @Get('events/endpoint/:id')
  getEventsByEndpoint(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.svc.getEventsByEndpoint(id, parseInt(limit || '50', 10));
  }

  /** 24h stats summary */
  @Get('stats')
  getStats() { return this.svc.getStats(); }

  /** Current rate-limit counters for an endpoint */
  @Get('rate-limits/:endpointId')
  getRateLimits(@Param('endpointId') endpointId: string) {
    return this.svc.getRateLimitStatus(endpointId);
  }

  /** Unblock a specific identifier (IP, fingerprint) */
  @Post('unblock')
  unblock(@Body() body: { endpointId: string; identifier: string }) {
    const ok = this.svc.unblockIdentifier(body.endpointId, body.identifier);
    return { unblocked: ok };
  }

  /** Clear all rate-limit counters for an endpoint (or all) */
  @Delete('rate-limits/:endpointId?')
  clearLimits(@Param('endpointId') endpointId?: string) {
    this.svc.clearRateLimits(endpointId);
    return { cleared: true, endpointId: endpointId || 'all' };
  }
}
