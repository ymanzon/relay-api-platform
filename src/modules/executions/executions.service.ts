import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ApiExecution, ExecutionDocument, ExecutionStatus } from './execution.schema';

export interface SaveExecutionDto {
  endpointId: string; endpointName: string; virtualPath: string; method: string;
  status: ExecutionStatus; mode: 'proxy' | 'mock';
  startedAt: Date; finishedAt: Date; totalDurationMs: number; proxyDurationMs?: number;
  requestQuery: Record<string, any>; requestBody: Record<string, any>;
  requestHeaders: Record<string, any>; responseStatus: number; responseBody: any;
  preEventResults: any[]; postEventResults: any[];
  ctxExtras: Record<string, any>; validationErrors: string[];
  errorMessage?: string; apiKeyUsed?: boolean; cacheHit?: boolean;
}

const TIME_RANGES: Record<string, number> = { '10m': 10, '30m': 30, '1h': 60, '3h': 180, '24h': 1440, 'all': 0 };

// Helper: bucket expression (5-min windows) using $toLong to avoid Date divide error
const bucketExpr = (field = '$startedAt') => ({
  $subtract: [
    { $divide: [{ $toLong: field }, 60000] },
    { $mod:    [{ $divide: [{ $toLong: field }, 60000] }, 5] },
  ],
});

@Injectable()
export class ExecutionsService {
  constructor(
    @InjectModel(ApiExecution.name)
    private readonly execModel: Model<ExecutionDocument>,
  ) {}

  async save(dto: SaveExecutionDto): Promise<ApiExecution> {
    return new this.execModel({ ...dto, endpointId: new Types.ObjectId(dto.endpointId) }).save();
  }

  private buildTimeFilter(range: string): Record<string, any> {
    const minutes = TIME_RANGES[range] ?? 0;
    if (!minutes) return {};
    return { startedAt: { $gte: new Date(Date.now() - minutes * 60_000) } };
  }

  async findRecent(opts: { limit?: number; range?: string; endpointId?: string; since?: string } = {}): Promise<ApiExecution[]> {
    const filter: any = { ...this.buildTimeFilter(opts.range || 'all') };
    if (opts.endpointId) filter.endpointId = new Types.ObjectId(opts.endpointId);
    if (opts.since)      filter.startedAt  = { $gt: new Date(opts.since) };
    return this.execModel.find(filter).sort({ startedAt: -1 }).limit(opts.limit || 200).lean().exec();
  }

  async findByEndpoint(id: string, limit = 100, range = 'all') {
    return this.findRecent({ limit, range, endpointId: id });
  }

  async globalStats(range = 'all') {
    const tf       = this.buildTimeFilter(range);
    const prevTf   = this.buildPrevTimeFilter(range); // comparison period

    const [totals, prevTotals, topEndpoints, timeline, byStatus, byMethod, latencyAll] = await Promise.all([
      // Current period totals
      this.execModel.aggregate([
        { $match: tf },
        { $group: {
          _id: null,
          total:     { $sum: 1 },
          success:   { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
          errors:    { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } },
          avgMs:     { $avg: '$totalDurationMs' },
          minMs:     { $min: '$totalDurationMs' },
          maxMs:     { $max: '$totalDurationMs' },
          cacheHits: { $sum: { $cond: ['$cacheHit', 1, 0] } },
        }},
      ]).exec(),

      // Previous period for delta comparison
      this.execModel.aggregate([
        { $match: prevTf },
        { $group: { _id: null, total: { $sum: 1 }, errors: { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } }, avgMs: { $avg: '$totalDurationMs' } } },
      ]).exec(),

      // Top endpoints by volume
      this.execModel.aggregate([
        { $match: tf },
        { $group: {
          _id:       '$endpointId',
          name:      { $last: '$endpointName' },
          path:      { $last: '$virtualPath' },
          method:    { $last: '$method' },
          calls:     { $sum: 1 },
          avgMs:     { $avg: '$totalDurationMs' },
          minMs:     { $min: '$totalDurationMs' },
          maxMs:     { $max: '$totalDurationMs' },
          errors:    { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } },
          cacheHits: { $sum: { $cond: ['$cacheHit', 1, 0] } },
        }},
        { $sort: { calls: -1 } }, { $limit: 10 },
      ]).exec(),

      // Timeline with 5-min buckets
      this.execModel.aggregate([
        { $match: tf },
        { $group: {
          _id:    bucketExpr(),
          count:  { $sum: 1 },
          errors: { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } },
          avgMs:  { $avg: '$totalDurationMs' },
        }},
        { $sort: { _id: 1 } }, { $limit: 288 },
      ]).exec(),

      // HTTP status code distribution
      this.execModel.aggregate([
        { $match: tf },
        { $group: { _id: '$responseStatus', count: { $sum: 1 } } },
        { $sort: { count: -1 } }, { $limit: 8 },
      ]).exec(),

      // HTTP method distribution
      this.execModel.aggregate([
        { $match: tf },
        { $group: { _id: '$method', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]).exec(),

      // All latency values for percentile approximation (capped at 1000)
      this.execModel.aggregate([
        { $match: tf },
        { $project: { totalDurationMs: 1 } },
        { $sort: { totalDurationMs: 1 } },
        { $limit: 1000 },
      ]).exec(),
    ]);

    const t    = totals[0]    || { total: 0, success: 0, errors: 0, avgMs: 0, minMs: 0, maxMs: 0, cacheHits: 0 };
    const prev = prevTotals[0] || { total: 0, errors: 0, avgMs: 0 };
    const latencies = latencyAll.map((d: any) => d.totalDurationMs as number).filter(n => n != null);
    const p95 = this.percentile(latencies, 95);
    const p99 = this.percentile(latencies, 99);

    return {
      total:     t.total,
      success:   t.success,
      errors:    t.errors,
      avgMs:     Math.round(t.avgMs || 0),
      minMs:     t.minMs || 0,
      maxMs:     t.maxMs || 0,
      p95Ms:     p95,
      p99Ms:     p99,
      cacheHits: t.cacheHits,
      errorRate: t.total > 0 ? Math.round((t.errors / t.total) * 100 * 10) / 10 : 0,
      cacheRate: t.total > 0 ? Math.round((t.cacheHits / t.total) * 100 * 10) / 10 : 0,
      // Deltas vs previous period
      delta: {
        total:  prev.total  ? Math.round(((t.total   - prev.total)  / prev.total)  * 100) : null,
        errors: prev.errors ? Math.round(((t.errors  - prev.errors) / prev.errors) * 100) : null,
        avgMs:  prev.avgMs  ? Math.round(((t.avgMs   - prev.avgMs)  / prev.avgMs)  * 100) : null,
      },
      topEndpoints: topEndpoints.map(e => ({
        id:        e._id?.toString(),
        name:      e.name,
        path:      e.path,
        method:    e.method,
        calls:     e.calls,
        avgMs:     Math.round(e.avgMs || 0),
        minMs:     e.minMs || 0,
        maxMs:     e.maxMs || 0,
        errors:    e.errors,
        cacheHits: e.cacheHits,
        errorRate: e.calls > 0 ? Math.round((e.errors / e.calls) * 100 * 10) / 10 : 0,
      })),
      timeline: timeline.map((b: any) => ({
        ts:     b._id * 60000,
        count:  b.count,
        errors: b.errors,
        avgMs:  Math.round(b.avgMs || 0),
      })),
      byStatus: byStatus.map((s: any) => ({ code: s._id, count: s.count })),
      byMethod: byMethod.map((m: any) => ({ method: m._id, count: m.count })),
    };
  }

  async endpointStats(endpointId: string, range = '1h') {
    const tf = { endpointId: new Types.ObjectId(endpointId), ...this.buildTimeFilter(range) };

    const [summary, timeline, latencyAll, recentErrors] = await Promise.all([
      this.execModel.aggregate([
        { $match: tf },
        { $group: { _id: '$status', count: { $sum: 1 }, avgMs: { $avg: '$totalDurationMs' }, minMs: { $min: '$totalDurationMs' }, maxMs: { $max: '$totalDurationMs' } } },
      ]).exec(),

      this.execModel.aggregate([
        { $match: tf },
        { $group: {
          _id:    bucketExpr(),
          count:  { $sum: 1 },
          avgMs:  { $avg: '$totalDurationMs' },
          errors: { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } },
        }},
        { $sort: { _id: 1 } }, { $limit: 72 },
      ]).exec(),

      this.execModel.aggregate([
        { $match: tf }, { $project: { totalDurationMs: 1 } },
        { $sort: { totalDurationMs: 1 } }, { $limit: 500 },
      ]).exec(),

      this.execModel.find({ ...tf, status: 'error' })
        .sort({ startedAt: -1 }).limit(5)
        .select('startedAt errorMessage responseStatus totalDurationMs').lean().exec(),
    ]);

    const latencies = latencyAll.map((d: any) => d.totalDurationMs as number).filter(n => n != null);

    return {
      summary,
      p95Ms: this.percentile(latencies, 95),
      p99Ms: this.percentile(latencies, 99),
      timeline: timeline.map((b: any) => ({
        ts:     b._id * 60000,
        count:  b.count,
        avgMs:  Math.round(b.avgMs || 0),
        errors: b.errors,
      })),
      recentErrors,
    };
  }

  // ── Deletes ────────────────────────────────────────────────────────────
  async deleteById(id: string): Promise<void> {
    await this.execModel.findByIdAndDelete(id).exec();
  }

  async deleteBulk(opts: { ids?: string[]; range?: string; endpointId?: string; status?: string }): Promise<number> {
    const filter: any = {};
    if (opts.ids?.length)  filter._id       = { $in: opts.ids.map(id => new Types.ObjectId(id)) };
    if (opts.endpointId)   filter.endpointId = new Types.ObjectId(opts.endpointId);
    if (opts.status)       filter.status     = opts.status;
    if (opts.range) {
      const tf = this.buildTimeFilter(opts.range);
      if (tf.startedAt) filter.startedAt = tf.startedAt;
    }
    return (await this.execModel.deleteMany(filter).exec()).deletedCount;
  }

  async deleteByEndpoint(id: string): Promise<void> {
    await this.execModel.deleteMany({ endpointId: new Types.ObjectId(id) }).exec();
  }

  // ── Helpers ────────────────────────────────────────────────────────────
  private percentile(sorted: number[], p: number): number {
    if (!sorted.length) return 0;
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
  }

  private buildPrevTimeFilter(range: string): Record<string, any> {
    const minutes = TIME_RANGES[range] ?? 0;
    if (!minutes) return {};
    const now  = Date.now();
    const from = new Date(now - minutes * 2 * 60_000);
    const to   = new Date(now - minutes * 60_000);
    return { startedAt: { $gte: from, $lt: to } };
  }
}
