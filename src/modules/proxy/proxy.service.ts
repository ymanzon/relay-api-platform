import { Injectable, Logger } from '@nestjs/common';
import { EndpointsService } from '../endpoints/endpoints.service';
import { EventsService, MutableEventContext } from '../events/events.service';
import { ExecutionsService } from '../executions/executions.service';
import { CacheService } from '../cache/cache.service';
import { SecretsService } from '../secrets/secrets.service';
import { SecurityService, EndpointSecurityConfig } from '../security/security.service';
import { EnvironmentsService } from '../environments/environments.service';
import { ExecutionStatus } from '../executions/execution.schema';

export interface ProxyRequest {
  path: string; method: string;
  query: Record<string, any>; body: Record<string, any>;
  headers: Record<string, any>; params: Record<string, any>;
  file?: { buffer: Buffer; originalname: string; mimetype: string; size: number };
  files?: any[];
  clientIp?: string;   // resolved real IP from controller
  bodyRawSize?: number; // raw body bytes for size check
}

export interface ProxyResponse {
  statusCode: number; body: any; headers: Record<string, any>;
  fileBuffer?: Buffer; fileInfo?: { name: string; mime: string };
  meta?: {
    endpointId: string; endpointName: string; mode: 'proxy' | 'mock';
    totalDurationMs: number; proxyDurationMs?: number;
    cacheHit?: boolean; cacheTtl?: number;
    preEvents: any[]; postEvents: any[];
    ctxExtras: Record<string, any>;
    validationErrors?: string[];
    apiKeyStatus?: string;
    secretsResolved?: string[];
    securityHeaders?: Record<string, string>;
    fingerprint?: string;
    rateLimitRemaining?: number;
  };
}

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  constructor(
    private readonly endpointsService: EndpointsService,
    private readonly eventsService:    EventsService,
    private readonly executionsService: ExecutionsService,
    private readonly cacheService:      CacheService,
    private readonly secretsService:    SecretsService,
    private readonly securityService:      SecurityService,
    private readonly environmentsService: EnvironmentsService,
  ) {}

  async handle(req: ProxyRequest): Promise<ProxyResponse> {
    const globalStart = Date.now();
    const startedAt   = new Date();

    // ── 1. Lookup ──────────────────────────────────────────────
    const endpoint = await this.endpointsService.findByPath(req.path, req.method);
    if (!endpoint) {
      return {
        statusCode: 404,
        body: { error: 'Not Found', message: `No active endpoint for [${req.method}] /api/${req.path}` },
        headers: { 'X-Api-Catalog': 'miss' },
      };
    }
    const endpointId = (endpoint as any)._id.toString();

    // ── 2. API Key ─────────────────────────────────────────────
    let apiKeyStatus = 'not_required';
    if (endpoint.requireApiKey) {
      const key = req.headers['x-api-key'] || req.query['x-api-key'];
      if (!key) return this.buildKeyError(endpointId, endpoint, 'missing', globalStart, startedAt, req);
      if (key !== endpoint.apiKey) return this.buildKeyError(endpointId, endpoint, 'invalid', globalStart, startedAt, req);
      apiKeyStatus = 'valid';
    }

    // ── 2.5. Security pipeline ────────────────────────────────────
    const secCfg = endpoint.securityConfig as EndpointSecurityConfig | undefined;
    this.logger.debug(
      `[SEC] ${endpoint.virtualPath} | enabled=${secCfg?.enabled} ` +
      `rl=${secCfg?.rateLimit?.enabled} ip=${req.clientIp || 'unknown'}`
    );
    if (secCfg?.enabled) {
      const secResult = await this.securityService.check({
        endpointId,
        endpointName: endpoint.name,
        virtualPath:  endpoint.virtualPath,
        clientIp:     req.clientIp || req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || '0.0.0.0',
        method:       req.method,
        headers:      req.headers,
        query:        req.query,
        body:         req.body,
        bodyRawSize:  req.bodyRawSize || Buffer.byteLength(JSON.stringify(req.body || {}), 'utf8'),
        securityConfig: secCfg,
      });
      if (!secResult.allowed) {
        // Set security headers on error response
        const errHeaders: Record<string, string> = { 'X-Api-Catalog': 'security-block', ...(secResult.headers || {}) };
        this.persistExecution({ endpointId, endpoint, globalStart, startedAt, req,
          response: { statusCode: secResult.statusCode!, body: { error: secResult.errorCode, message: secResult.message }, headers: errHeaders },
          preResults: [], postResults: [], validationErrors: [secResult.errorCode || ''],
          mode: endpoint.destinationUrl ? 'proxy' : 'mock', execStatus: ExecutionStatus.ERROR,
          apiKeyStatus, ctxExtras: {}, errorMessage: secResult.message });
        return { statusCode: secResult.statusCode!, body: { error: secResult.errorCode, message: secResult.message }, headers: errHeaders };
      }
    }

        // ── 3. Cache check ─────────────────────────────────────────
    const cc = endpoint.cacheConfig;
    let cacheKey: string | null = null;
    if (cc?.enabled) {
      const q = cc.ignoreQuery ? {} : req.query;
      const b = cc.ignoreBody  ? {} : req.body;
      cacheKey = this.cacheService.buildTaggedKey(endpointId, q, b);
      const cached = this.cacheService.get(cacheKey);
      if (cached.hit) {
        this.logger.log(`⚡ CACHE HIT [${endpoint.virtualPath}]`);
        this.persistExecution({ endpointId, endpoint, globalStart, startedAt, req, response: cached.value, preResults: [], postResults: [], validationErrors: [], mode: endpoint.destinationUrl ? 'proxy' : 'mock', execStatus: ExecutionStatus.SUCCESS, apiKeyStatus, cacheHit: true });
        return { ...cached.value, meta: { ...cached.value.meta, cacheHit: true, cacheTtl: cc.ttlSeconds } };
      }
    }

    // ── 3.5. Resolve environment variables ([[VAR]]) ──────────
    // Runs BEFORE secret resolution so vars can themselves contain {{SECRET}} refs
    const envVarMap = await this.environmentsService.buildVarMap();
    let resolvedDestUrl: string = this.environmentsService.resolveString(
      endpoint.destinationUrl || '', envVarMap
    );
    let resolvedDestHeaders: Record<string, string> = this.environmentsService.resolveHeaders(
      endpoint.destinationHeaders || {}, envVarMap
    );
    const envVarsResolved = [
      ...this.environmentsService.extractVarNames(endpoint.destinationUrl || ''),
      ...Object.values(endpoint.destinationHeaders || {}).flatMap(
        v => this.environmentsService.extractVarNames(String(v))
      ),
    ];

    // ── 4. Resolve secrets in destination headers & URL ────────
    // {{SECRET_NAME}} placeholders are resolved here — values NEVER logged
    const secretsResolved: string[] = [];
    try {
      // Collect secret names for audit
      for (const v of Object.values(resolvedDestHeaders)) {
        secretsResolved.push(...this.secretsService.extractNames(String(v)));
      }
      secretsResolved.push(...this.secretsService.extractNames(resolvedDestUrl));

      resolvedDestHeaders = await this.secretsService.resolveHeaders(resolvedDestHeaders);
      resolvedDestUrl     = await this.secretsService.resolveString(resolvedDestUrl);
    } catch (err) {
      this.logger.warn(`Secret resolution failed: ${err.message}`);
      return {
        statusCode: 500,
        body: { error: 'Secret Resolution Error', message: err.message },
        headers: { 'X-Api-Catalog': 'error' },
      };
    }

    // ── 5. Validate params ─────────────────────────────────────
    const validationErrors = this.validateParams(req, endpoint);

    // ── 6. Build ctx + secrets proxy ───────────────────────────
    // secrets proxy is read-only and its values never appear in logs or DB
    const secretsProxy = await this.secretsService.buildSecretsProxy();
    const ctx: MutableEventContext = {
      phase: 'pre',
      endpoint: { id: endpointId, name: endpoint.name, virtualPath: endpoint.virtualPath, method: endpoint.method },
      request:  { query: req.query, body: req.body, headers: req.headers },
      extras:   {},
      secrets:  secretsProxy,   // ← scripts access via ctx.secrets.MY_TOKEN
      timestamp: startedAt.toISOString(),
    };

    // ── 7. PRE events ──────────────────────────────────────────
    const preResults: any[] = [];
    for (const event of (endpoint.preEvents || []) as any[]) {
      this.logger.log(`▶ PRE  [${endpoint.virtualPath}] → ${event.name}`);
      const r = await this.eventsService.execute(event, ctx);
      preResults.push({ ...r, eventId: event._id?.toString(), eventName: event.name });
    }

    // ── 8. Main call ───────────────────────────────────────────
    ctx.phase = 'post';
    let response: { statusCode: number; body: any; headers: Record<string, any>; fileBuffer?: Buffer; fileInfo?: any };
    let proxyDurationMs: number | undefined;
    let execStatus = ExecutionStatus.SUCCESS;
    let errorMessage: string | undefined;
    const mode = resolvedDestUrl ? 'proxy' : 'mock';

    try {
      if (resolvedDestUrl) {
        const t = Date.now();
        response = await this.callDestination(endpoint, req, resolvedDestUrl, resolvedDestHeaders);
        proxyDurationMs = Date.now() - t;
      } else {
        response = await this.serveMock(endpoint, req);
      }
    } catch (err) {
      execStatus   = ExecutionStatus.ERROR;
      errorMessage = err.message;
      response     = { statusCode: 502, body: { error: 'Bad Gateway', message: err.message }, headers: {} };
    }

    ctx.response = response;

    // ── 9. POST events ─────────────────────────────────────────
    const postResults: any[] = [];
    for (const event of (endpoint.postEvents || []) as any[]) {
      this.logger.log(`◀ POST [${endpoint.virtualPath}] → ${event.name}`);
      const r = await this.eventsService.execute(event, ctx);
      postResults.push({ ...r, eventId: event._id?.toString(), eventName: event.name });
    }

    const totalDurationMs = Date.now() - globalStart;

    // ── 10. Build final response ───────────────────────────────
    const proxyResponse: ProxyResponse = {
      ...response,
      meta: {
        endpointId, endpointName: endpoint.name, mode,
        totalDurationMs, proxyDurationMs, cacheHit: false,
        preEvents: preResults, postEvents: postResults,
        ctxExtras: ctx.extras,
        validationErrors: validationErrors.length ? validationErrors : undefined,
        apiKeyStatus,
        secretsResolved: [...new Set(secretsResolved)],
      },
    };

    if (cacheKey && cc?.enabled && execStatus === ExecutionStatus.SUCCESS) {
      this.cacheService.set(cacheKey, proxyResponse, cc.ttlSeconds || 60);
    }

    this.logger.log(
      `[${execStatus.toUpperCase()}] ${endpoint.method} /api/${endpoint.virtualPath} → ` +
      `${response.statusCode} | ${totalDurationMs}ms | ${mode}` +
      (secretsResolved.length ? ` | secrets:[${[...new Set(secretsResolved)].join(',')}]` : ''),
    );

    this.persistExecution({
      endpointId, endpoint, globalStart, startedAt, req,
      response, preResults, postResults,
      validationErrors, mode, execStatus, errorMessage, apiKeyStatus,
      proxyDurationMs, cacheHit: false, ctxExtras: ctx.extras,
    });

    return proxyResponse;
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private persistExecution(opts: any) {
    this.executionsService.save({
      endpointId: opts.endpointId, endpointName: opts.endpoint.name,
      virtualPath: opts.endpoint.virtualPath, method: opts.endpoint.method,
      status: opts.execStatus, mode: opts.mode,
      startedAt: opts.startedAt, finishedAt: new Date(),
      totalDurationMs: Date.now() - opts.globalStart,
      proxyDurationMs: opts.proxyDurationMs,
      requestQuery: opts.req.query, requestBody: opts.req.body,
      requestHeaders: this.sanitizeHeaders(opts.req.headers),
      responseStatus: opts.response.statusCode, responseBody: opts.response.body,
      preEventResults: opts.preResults, postEventResults: opts.postResults,
      ctxExtras: opts.ctxExtras || {}, validationErrors: opts.validationErrors,
      errorMessage: opts.errorMessage, apiKeyUsed: opts.apiKeyStatus === 'valid',
      cacheHit: !!opts.cacheHit,
    }).catch(e => this.logger.error(`Save execution: ${e.message}`));
  }

  private buildKeyError(endpointId: string, endpoint: any, reason: string, globalStart: number, startedAt: Date, req: ProxyRequest): ProxyResponse {
    const msg = reason === 'missing' ? 'Missing x-api-key header' : 'Invalid x-api-key';
    this.persistExecution({ endpointId, endpoint, globalStart, startedAt, req, response: { statusCode: 401, body: { error: 'Unauthorized', message: msg }, headers: {} }, preResults: [], postResults: [], validationErrors: [], mode: 'proxy', execStatus: ExecutionStatus.ERROR, apiKeyStatus: reason, ctxExtras: {}, errorMessage: msg });
    return { statusCode: 401, body: { error: 'Unauthorized', message: msg }, headers: { 'WWW-Authenticate': 'ApiKey' } };
  }

  private validateParams(req: ProxyRequest, endpoint: any): string[] {
    const errs: string[] = [];
    for (const p of endpoint.queryParams || []) {
      if (p.required && req.query[p.name] === undefined) errs.push(`Missing required query param: '${p.name}'`);
    }
    if (['POST','PUT','PATCH'].includes(endpoint.method)) {
      for (const p of endpoint.bodyParams || []) {
        if (p.required && req.body?.[p.name] === undefined) errs.push(`Missing required body param: '${p.name}'`);
      }
    }
    return errs;
  }

  private async callDestination(
    endpoint: any, req: ProxyRequest,
    resolvedUrl: string, resolvedHeaders: Record<string, string>,
  ) {
    const axios    = require('axios');
    const FormData = require('form-data');
    const url      = new URL(resolvedUrl);
    Object.entries(req.query).forEach(([k, v]) => url.searchParams.set(k, String(v)));

    let data: any    = req.body;
    let extraHeaders = {};

    if (endpoint.fileConfig?.enabled && (endpoint.fileConfig.mode === 'upload' || endpoint.fileConfig.mode === 'both') && req.file) {
      const form = new FormData();
      form.append(endpoint.fileConfig.fieldName || 'file', req.file.buffer, { filename: req.file.originalname, contentType: req.file.mimetype });
      Object.entries(req.body || {}).forEach(([k, v]) => form.append(k, String(v)));
      data         = form;
      extraHeaders = form.getHeaders();
    }

    const resp = await axios({
      method: endpoint.method.toLowerCase(), url: url.toString(),
      headers: { ...this.sanitizeHeaders(req.headers), ...resolvedHeaders, ...extraHeaders },
      data, timeout: endpoint.timeoutMs || 30000, validateStatus: () => true,
      responseType: (endpoint.fileConfig?.mode === 'download' || endpoint.fileConfig?.mode === 'both') ? 'arraybuffer' : 'json',
    });

    const contentType = resp.headers['content-type'] || '';
    const isFile      = !contentType.includes('application/json') && !contentType.includes('text/');
    if (isFile && Buffer.isBuffer(resp.data)) {
      const disposition = resp.headers['content-disposition'] || '';
      const nameMatch   = disposition.match(/filename="?([^";\n]+)"?/i);
      return { statusCode: resp.status, body: null, headers: { 'X-Api-Catalog': 'proxy', ...this.filterResponseHeaders(resp.headers) }, fileBuffer: resp.data, fileInfo: { name: nameMatch?.[1] || 'download', mime: contentType } };
    }

    return { statusCode: resp.status, body: resp.data, headers: { 'X-Api-Catalog': 'proxy', ...this.filterResponseHeaders(resp.headers) } };
  }

  private async serveMock(endpoint: any, req: ProxyRequest) {
    const m = endpoint.mockResponse || {};
    if (m.delayMs > 0) await new Promise(r => setTimeout(r, Math.min(m.delayMs, 30000)));
    if (endpoint.fileConfig?.enabled && m.fileBase64 && m.fileName) {
      return { statusCode: m.statusCode || 200, body: null, headers: { 'X-Api-Catalog': 'mock', 'Content-Type': m.fileMimeType || 'application/octet-stream', 'Content-Disposition': `attachment; filename="${m.fileName}"`, ...(m.headers || {}) }, fileBuffer: Buffer.from(m.fileBase64, 'base64'), fileInfo: { name: m.fileName, mime: m.fileMimeType || 'application/octet-stream' } };
    }
    return { statusCode: m.statusCode || 200, body: m.body ?? { message: 'Mock response', endpoint: endpoint.name }, headers: { 'X-Api-Catalog': 'mock', ...(m.headers || {}) } };
  }

  private sanitizeHeaders(h: Record<string, any>): Record<string, string> {
    const skip = ['host', 'connection', 'content-length', 'transfer-encoding'];
    return Object.fromEntries(Object.entries(h).filter(([k]) => !skip.includes(k.toLowerCase())).map(([k, v]) => [k, String(v)]));
  }

  private filterResponseHeaders(h: Record<string, any>): Record<string, string> {
    const skip = ['content-encoding', 'transfer-encoding', 'connection'];
    return Object.fromEntries(Object.entries(h).filter(([k]) => !skip.includes(k.toLowerCase())).map(([k, v]) => [k, String(v)]));
  }
}
