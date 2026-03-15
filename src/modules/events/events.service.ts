import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiEvent, EventDocument } from './schemas/event.schema';
import { CreateEventDto } from './dto/create-event.dto';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectModel(ApiEvent.name) private eventModel: Model<EventDocument>,
  ) {}

  async create(dto: CreateEventDto): Promise<ApiEvent> { return new this.eventModel(dto).save(); }
  async findAll(): Promise<ApiEvent[]> { return this.eventModel.find().sort({ createdAt: -1 }).exec(); }
  async findOne(id: string): Promise<ApiEvent> {
    const e = await this.eventModel.findById(id).exec();
    if (!e) throw new Error(`Event ${id} not found`);
    return e;
  }
  async update(id: string, dto: Partial<CreateEventDto>): Promise<ApiEvent> {
    const e = await this.eventModel.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!e) throw new Error(`Event ${id} not found`);
    return e;
  }
  async remove(id: string): Promise<void> { await this.eventModel.findByIdAndDelete(id).exec(); }

  async execute(event: ApiEvent, ctx: MutableEventContext): Promise<EventExecResult> {
    if (!event.enabled) return { skipped: true, reason: 'Event disabled', durationMs: 0 };
    const t0 = Date.now();
    try {
      let result: any;
      if (event.type === 'webhook') result = await this.executeWebhook(event, ctx);
      else if (event.type === 'script') result = await this.executeScript(event, ctx);
      else return { skipped: true, reason: 'Unknown type', durationMs: 0 };
      return { success: true, durationMs: Date.now() - t0, result };
    } catch (err) {
      this.logger.warn(`Event "${event.name}" failed: ${err.message}`);
      return { success: false, error: err.message, durationMs: Date.now() - t0 };
    }
  }

  private async executeWebhook(event: ApiEvent, ctx: MutableEventContext) {
    const axios = require('axios');
    const resp = await axios({
      method: (event.method || 'POST').toLowerCase(),
      url: event.url,
      headers: { 'Content-Type': 'application/json', ...(event.headers || {}) },
      data: { phase: ctx.phase, endpoint: ctx.endpoint, request: ctx.request, response: ctx.response, extras: ctx.extras, timestamp: ctx.timestamp },
      timeout: 10000,
    });
    return { statusCode: resp.status, data: resp.data };
  }

  private async executeScript(event: ApiEvent, ctx: MutableEventContext) {
    /**
     * ctx.secrets  — Read-only proxy populated by ProxyService before events run.
     *   Access: ctx.secrets.MY_TOKEN, ctx.secrets.API_KEY, etc.
     *   Scripts can inject secrets into request headers:
     *     ctx.request.headers['Authorization'] = `Bearer ${ctx.secrets.GITHUB_TOKEN}`;
     *     ctx.request.headers['x-api-key']     = ctx.secrets.THIRD_PARTY_KEY;
     *
     * ctx.extras   — Mutable shared space between pre/post events.
     *   ctx.extras.requestId = require('crypto').randomUUID();
     *
     * ctx.response — Available in POST events only.
     *   ctx.extras.elapsed = Date.now() - ctx.extras.startTime;
     */
    const fn = new Function('ctx', 'require', 'console', `
      "use strict";
      ${event.script}
    `);

    const safeRequire = (mod: string) => {
      const allowed = ['crypto', 'querystring', 'url', 'buffer'];
      if (!allowed.includes(mod)) throw new Error(`Module '${mod}' not allowed in scripts`);
      return require(mod);
    };

    const safeConsole = {
      log:   (...a: any[]) => this.logger.log(`[script:${event.name}] ${a.join(' ')}`),
      warn:  (...a: any[]) => this.logger.warn(`[script:${event.name}] ${a.join(' ')}`),
      error: (...a: any[]) => this.logger.error(`[script:${event.name}] ${a.join(' ')}`),
    };

    const ret = fn(ctx, safeRequire, safeConsole);
    return ret instanceof Promise ? await ret : ret;
  }
}

/* ── Exported types ──────────────────────────────────────────── */

export interface MutableEventContext {
  phase:    'pre' | 'post';
  endpoint: { id: string; name: string; virtualPath: string; method: string };
  request:  { query: Record<string, any>; body: Record<string, any>; headers: Record<string, any> };
  response?: { statusCode: number; body: any; headers: Record<string, any> };
  extras:   Record<string, any>;
  /**
   * Read-only secrets proxy. Access values by name:
   *   ctx.secrets.GITHUB_TOKEN
   *   ctx.secrets.STRIPE_SECRET_KEY
   * Values are decrypted at runtime and NEVER appear in logs or DB.
   */
  secrets:  Readonly<Record<string, string>>;
  timestamp: string;
}

export interface EventExecResult {
  success?:   boolean;
  skipped?:   boolean;
  reason?:    string;
  durationMs: number;
  result?:    any;
  error?:     string;
}
