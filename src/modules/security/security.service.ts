import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { SecurityEvent, SecurityEventDocument, SecurityEventType } from './security-event.schema';

// ── Rate limit store ───────────────────────────────────────────────────────
interface RLEntry {
  timestamps: number[];  // sliding window timestamps (ms)
  blockedUntil?: number;
}

// ── Threat patterns ────────────────────────────────────────────────────────
const THREAT_PATTERNS: { name: string; re: RegExp }[] = [
  { name: 'SQLi-union',    re: /(\bunion\b.+\bselect\b|\bselect\b.+\bfrom\b)/i },
  { name: 'SQLi-comment',  re: /(--|;|\/\*|\*\/|xp_|exec\s*\()/i },
  { name: 'XSS-script',    re: /<script[\s>]|javascript:|on\w+\s*=/i },
  { name: 'XSS-entity',    re: /&lt;script|%3cscript|&#x3c;script/i },
  { name: 'PathTraversal', re: /(\.\.[\/\\]){2,}|%2e%2e[%2f%5c]/i },
  { name: 'CmdInjection',  re: /[;&|`$]\s*(ls|cat|rm|wget|curl|bash|sh)\b/i },
  { name: 'NoSQLi',        re: /\$where|\$gt|\$regex|\$or|\$and|\$nin/i },
  { name: 'SSTI',          re: /\{\{.+\}\}|\$\{.+\}|<%=.+%>/i },
];

// ── Public types ───────────────────────────────────────────────────────────
export interface SecurityCheckInput {
  endpointId:   string;
  endpointName: string;
  virtualPath:  string;
  clientIp:     string;
  method:       string;
  headers:      Record<string, any>;
  query:        Record<string, any>;
  body:         Record<string, any>;
  bodyRawSize:  number;          // bytes
  securityConfig: EndpointSecurityConfig;
}

export interface SecurityCheckResult {
  allowed: boolean;
  statusCode?: number;
  errorCode?:  string;
  message?:    string;
  headers?:    Record<string, string>;  // e.g. Retry-After, X-RateLimit-*
  fingerprint?: string;
}

export interface RateLimitCfg {
  enabled:           boolean;
  requests:          number;
  windowSecs:        number;
  strategy:          'ip' | 'apikey' | 'fingerprint' | 'global';
  blockDurationSecs: number;
}

export interface EndpointSecurityConfig {
  enabled:   boolean;
  // Rate limiting — nested object matching the schema's RateLimitConfig class
  rateLimit: RateLimitCfg;
  // IP control
  ipAllowlist: string[];
  ipBlocklist:  string[];
  // Fingerprinting
  fingerprintEnabled:   boolean;
  fingerprintBlocklist: string[];
  // Threat detection
  threatDetectionEnabled: boolean;
  // HMAC request signing
  hmacEnabled:    boolean;
  hmacSecret:     string;
  hmacHeader:     string;
  hmacAlgorithm:  string;
  // Body size limit (0 = disabled)
  maxBodySizeKb:  number;
  // CORS per endpoint
  corsEnabled:    boolean;
  corsOrigins:    string[];
}

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);
  /** key: `${endpointId}:${strategy}:${identifier}` → RLEntry */
  private readonly rlStore = new Map<string, RLEntry>();

  constructor(
    @InjectModel(SecurityEvent.name) private readonly eventModel: Model<SecurityEventDocument>,
  ) {
    // Purge expired RL entries every 5 minutes
    setInterval(() => this.purgeRLStore(), 5 * 60 * 1000);
  }

  // ── Main pipeline ─────────────────────────────────────────────────────────
  async check(input: SecurityCheckInput): Promise<SecurityCheckResult> {
    const cfg = input.securityConfig;
    if (!cfg?.enabled) return { allowed: true };

    this.logger.log(
      `[SEC CHECK] ${input.method} /${input.virtualPath} | ip=${input.clientIp} ` +
      `rl=${cfg.rateLimit?.enabled} threat=${cfg.threatDetectionEnabled} hmac=${cfg.hmacEnabled}`
    );

    // 1. CORS check
    if (cfg.corsEnabled && cfg.corsOrigins?.length) {
      const origin = input.headers['origin'] as string || '';
      if (origin && !this.isCorsAllowed(origin, cfg.corsOrigins)) {
        await this.log(input, SecurityEventType.CORS_REJECTED, { detail: `Origin: ${origin}` });
        return { allowed: false, statusCode: 403, errorCode: 'CORS_REJECTED', message: `Origin '${origin}' is not allowed` };
      }
    }

    // 2. IP allowlist / blocklist
    const ipResult = this.checkIp(input.clientIp, cfg.ipAllowlist, cfg.ipBlocklist);
    if (!ipResult.allowed) {
      const evType = ipResult.reason === 'blocklist' ? SecurityEventType.IP_BLOCKED : SecurityEventType.IP_NOT_ALLOWED;
      await this.log(input, evType, { detail: `IP: ${input.clientIp}` });
      return { allowed: false, statusCode: 403, errorCode: ipResult.reason === 'blocklist' ? 'IP_BLOCKED' : 'IP_NOT_ALLOWED', message: 'Access denied from your IP address' };
    }

    // 3. Build fingerprint
    const fingerprint = this.buildFingerprint(input);

    // 4. Fingerprint blocklist
    if (cfg.fingerprintEnabled && cfg.fingerprintBlocklist?.includes(fingerprint)) {
      await this.log(input, SecurityEventType.FINGERPRINT_BLOCKED, { detail: fingerprint });
      return { allowed: false, statusCode: 403, errorCode: 'FINGERPRINT_BLOCKED', message: 'Access denied', headers: { 'X-Fingerprint': fingerprint } };
    }

    // 5. Body size limit
    if (cfg.maxBodySizeKb > 0 && input.bodyRawSize > cfg.maxBodySizeKb * 1024) {
      await this.log(input, SecurityEventType.BODY_TOO_LARGE, { detail: `${Math.round(input.bodyRawSize/1024)}KB > ${cfg.maxBodySizeKb}KB` });
      return { allowed: false, statusCode: 413, errorCode: 'BODY_TOO_LARGE', message: `Request body exceeds ${cfg.maxBodySizeKb}KB limit` };
    }

    // 6. HMAC signature verification
    if (cfg.hmacEnabled && cfg.hmacSecret) {
      const sigResult = this.verifyHmac(input, cfg);
      if (!sigResult.valid) {
        await this.log(input, SecurityEventType.HMAC_INVALID, { detail: sigResult.reason });
        return { allowed: false, statusCode: 401, errorCode: 'HMAC_INVALID', message: `Request signature invalid: ${sigResult.reason}` };
      }
    }

    // 7. Threat detection
    if (cfg.threatDetectionEnabled) {
      const threat = this.scanForThreats(input.query, input.body, input.headers);
      if (threat) {
        await this.log(input, SecurityEventType.THREAT_DETECTED, { detail: threat, fingerprint });
        return { allowed: false, statusCode: 400, errorCode: 'THREAT_DETECTED', message: `Request blocked: suspicious pattern detected (${threat})` };
      }
    }

    // 8. Rate limiting (last, so we don't burn limit on invalid requests)
    if (cfg.rateLimit?.enabled && cfg.rateLimit?.requests > 0) {
      const identifier = this.getRLIdentifier(cfg.rateLimit.strategy, input, fingerprint);
      const rlResult = this.checkRateLimit(input.endpointId, identifier, cfg);
      this.logger.log(
        `[RATE LIMIT] ${input.virtualPath} | id=${identifier} ` +
        `allowed=${rlResult.allowed} remaining=${rlResult.remaining ?? 'N/A'} ` +
        `limit=${cfg.rateLimit.requests}/${cfg.rateLimit.windowSecs}s`
      );
      if (!rlResult.allowed) {
        await this.log(input, SecurityEventType.RATE_LIMIT_EXCEEDED, {
          detail: `${cfg.rateLimit.requests}/${cfg.rateLimit.windowSecs}s strategy=${cfg.rateLimit.strategy}`,
          fingerprint, blocked: rlResult.blockedUntil !== undefined,
          blockedUntil: rlResult.blockedUntil ? new Date(rlResult.blockedUntil) : undefined,
        });
        const retryAfter = rlResult.blockedUntil
          ? Math.ceil((rlResult.blockedUntil - Date.now()) / 1000)
          : cfg.rateLimit.windowSecs;
        return {
          allowed: false, statusCode: 429, errorCode: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit exceeded: ${cfg.rateLimit.requests} requests per ${cfg.rateLimit.windowSecs}s`,
          headers: {
            'Retry-After':          String(retryAfter),
            'X-RateLimit-Limit':    String(cfg.rateLimit.requests),
            'X-RateLimit-Window':   String(cfg.rateLimit.windowSecs),
            'X-RateLimit-Reset':    String(Math.ceil(Date.now() / 1000) + retryAfter),
          },
        };
      }
      // Return remaining quota headers on success
      return {
        allowed: true,
        fingerprint,
        headers: {
          'X-RateLimit-Limit':     String(cfg.rateLimit.requests),
          'X-RateLimit-Remaining': String(rlResult.remaining),
          'X-RateLimit-Window':    String(cfg.rateLimit.windowSecs),
        },
      };
    }

    return { allowed: true, fingerprint };
  }

  // ── Fingerprint ───────────────────────────────────────────────────────────
  buildFingerprint(input: SecurityCheckInput | { headers: Record<string,any>; clientIp: string }): string {
    const h = input.headers;
    const components = [
      input.clientIp,
      (h['user-agent'] || '').substring(0, 200),
      h['accept-language'] || '',
      h['accept-encoding'] || '',
      h['accept'] || '',
      // Sec-CH-UA headers (modern browsers)
      h['sec-ch-ua'] || '',
      h['sec-ch-ua-platform'] || '',
      h['sec-ch-ua-mobile'] || '',
    ];
    return createHash('sha256').update(components.join('|')).digest('hex').substring(0, 16);
  }

  // ── Rate limiting (sliding window) ────────────────────────────────────────
  private checkRateLimit(
    endpointId: string,
    identifier: string,
    cfg: EndpointSecurityConfig,
  ): { allowed: boolean; remaining?: number; blockedUntil?: number } {
    const key     = `${endpointId}:${identifier}`;
    const now     = Date.now();
    const rl = cfg.rateLimit;
    const windowMs = rl.windowSecs * 1000;

    let entry = this.rlStore.get(key);
    if (!entry) { entry = { timestamps: [] }; this.rlStore.set(key, entry); }

    // Check if currently blocked
    if (entry.blockedUntil && now < entry.blockedUntil) {
      return { allowed: false, blockedUntil: entry.blockedUntil };
    }
    entry.blockedUntil = undefined; // unblock after time

    // Slide window — remove timestamps older than window
    entry.timestamps = entry.timestamps.filter(t => now - t < windowMs);

    if (entry.timestamps.length >= rl.requests) {
      // Exceeded — optionally apply block duration penalty
      if (rl.blockDurationSecs > 0 && !entry.blockedUntil) {
        entry.blockedUntil = now + rl.blockDurationSecs * 1000;
      }
      // Always return blockedUntil so caller can compute Retry-After correctly
      return { allowed: false, blockedUntil: entry.blockedUntil };
    }

    // Allow — record timestamp
    entry.timestamps.push(now);
    return { allowed: true, remaining: rl.requests - entry.timestamps.length };
  }

  private getRLIdentifier(
    strategy: string,
    input: SecurityCheckInput,
    fingerprint: string,
  ): string {
    switch (strategy) {
      case 'apikey':      return input.headers['x-api-key']?.toString().substring(0, 12) || 'nokey';
      case 'fingerprint': return fingerprint;
      case 'global':      return '__global__';
      case 'ip':
      default:            return input.clientIp;
    }
  }

  // ── IP check (exact + simple CIDR prefix) ─────────────────────────────────
  private checkIp(ip: string, allowlist: string[], blocklist: string[]): { allowed: boolean; reason?: string } {
    if (blocklist?.length && this.ipInList(ip, blocklist)) return { allowed: false, reason: 'blocklist' };
    if (allowlist?.length && !this.ipInList(ip, allowlist)) return { allowed: false, reason: 'not_in_allowlist' };
    return { allowed: true };
  }

  private ipInList(ip: string, list: string[]): boolean {
    for (const entry of list) {
      const e = entry.trim();
      if (!e) continue;
      if (e === ip) return true;
      // Simple CIDR: check if ip starts with network prefix (e.g. 192.168.)
      if (e.endsWith('.')) { if (ip.startsWith(e)) return true; continue; }
      if (e.includes('/')) {
        // Basic CIDR support for /24, /16, /8
        const [network, bits] = e.split('/');
        const prefixLen = parseInt(bits, 10);
        if (this.ipMatchCidr(ip, network, prefixLen)) return true;
      }
    }
    return false;
  }

  private ipMatchCidr(ip: string, network: string, prefixLen: number): boolean {
    try {
      const ipNum = ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
      const netNum = network.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
      const mask = prefixLen === 0 ? 0 : (0xffffffff << (32 - prefixLen)) >>> 0;
      return (ipNum & mask) === (netNum & mask);
    } catch { return false; }
  }

  // ── HMAC verification ─────────────────────────────────────────────────────
  private verifyHmac(input: SecurityCheckInput, cfg: EndpointSecurityConfig): { valid: boolean; reason?: string } {
    const headerName = (cfg.hmacHeader || 'x-signature').toLowerCase();
    const provided   = input.headers[headerName] as string;
    if (!provided) return { valid: false, reason: `Missing ${cfg.hmacHeader || 'X-Signature'} header` };

    // Compute HMAC over method + path + sorted query + body
    const algo      = cfg.hmacAlgorithm || 'sha256';
    const payload   = [
      input.method.toUpperCase(),
      `/${input.virtualPath}`,
      JSON.stringify(this.sortObj(input.query)),
      JSON.stringify(this.sortObj(input.body)),
    ].join('\n');

    const expected = createHmac(algo, cfg.hmacSecret).update(payload).digest('hex');
    try {
      const a = Buffer.from(provided.replace(/^sha\d+=/, ''), 'hex');
      const b = Buffer.from(expected, 'hex');
      if (a.length !== b.length) return { valid: false, reason: 'Signature length mismatch' };
      return { valid: timingSafeEqual(a, b) ? true : false, reason: timingSafeEqual(a, b) ? undefined : 'Signature mismatch' };
    } catch {
      return { valid: false, reason: 'Signature format invalid' };
    }
  }

  // ── Threat detection ──────────────────────────────────────────────────────
  private scanForThreats(
    query: Record<string, any>,
    body: Record<string, any>,
    headers: Record<string, any>,
  ): string | null {
    const scan = (val: any, depth = 0): string | null => {
      if (depth > 5) return null;
      if (typeof val === 'string') {
        for (const p of THREAT_PATTERNS) {
          if (p.re.test(val)) return p.name;
        }
      } else if (Array.isArray(val)) {
        for (const v of val) { const r = scan(v, depth + 1); if (r) return r; }
      } else if (val && typeof val === 'object') {
        for (const v of Object.values(val)) { const r = scan(v, depth + 1); if (r) return r; }
      }
      return null;
    };

    // Scan query params, body, and suspicious headers
    for (const src of [query, body, { referer: headers['referer'], cookie: headers['cookie'] }]) {
      const r = scan(src);
      if (r) return r;
    }
    return null;
  }

  // ── CORS ──────────────────────────────────────────────────────────────────
  isCorsAllowed(origin: string, origins: string[]): boolean {
    if (!origins?.length) return true;
    if (origins.includes('*')) return true;
    return origins.some(o => {
      if (o === origin) return true;
      if (o.startsWith('*.')) {
        const domain = o.substring(2);
        return origin.endsWith(domain);
      }
      return false;
    });
  }

  buildCorsHeaders(origin: string, cfg: EndpointSecurityConfig): Record<string, string> {
    if (!cfg.corsEnabled || !cfg.corsOrigins?.length) return {};
    const allowed = this.isCorsAllowed(origin, cfg.corsOrigins);
    return allowed ? {
      'Access-Control-Allow-Origin':  cfg.corsOrigins.includes('*') ? '*' : origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, x-signature',
      'Access-Control-Max-Age':       '86400',
    } : {};
  }

  // ── Audit log helpers ─────────────────────────────────────────────────────
  private async log(input: SecurityCheckInput, type: SecurityEventType, extra: any = {}): Promise<void> {
    try {
      const apiKey = input.headers['x-api-key'];
      await new this.eventModel({
        endpointId:   input.endpointId,
        endpointName: input.endpointName,
        virtualPath:  input.virtualPath,
        type,
        clientIp:     input.clientIp,
        fingerprint:  extra.fingerprint,
        userAgent:    (input.headers['user-agent'] || '').substring(0, 300),
        apiKey:       apiKey ? String(apiKey).slice(-6) : undefined,
        detail:       extra.detail,
        requestMeta:  { method: input.method, path: input.virtualPath, queryKeys: Object.keys(input.query) },
        blocked:      extra.blocked || false,
        blockedUntil: extra.blockedUntil,
      }).save();
    } catch (err) {
      this.logger.warn(`Failed to log security event: ${err.message}`);
    }
  }

  // ── Public queries for dashboard ──────────────────────────────────────────
  async getRecentEvents(limit = 100): Promise<SecurityEvent[]> {
    return this.eventModel.find().sort({ createdAt: -1 }).limit(limit).lean().exec();
  }

  async getEventsByEndpoint(endpointId: string, limit = 50): Promise<SecurityEvent[]> {
    return this.eventModel.find({ endpointId }).sort({ createdAt: -1 }).limit(limit).lean().exec();
  }

  async getStats(): Promise<any> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24h
    const byType = await this.eventModel.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]).exec();
    const topIps = await this.eventModel.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$clientIp', count: { $sum: 1 } } },
      { $sort: { count: -1 } }, { $limit: 10 },
    ]).exec();
    const total = byType.reduce((s, x) => s + x.count, 0);
    return {
      total24h:    total,
      byType:      byType.reduce((a, x) => { a[x._id] = x.count; return a; }, {}),
      topIps:      topIps.map(x => ({ ip: x._id, count: x.count })),
      blockedIps:  topIps.filter(x => x.count >= 5).length,
    };
  }

  /** Get current rate-limit status for an endpoint (for UI) */
  getRateLimitStatus(endpointId: string): { identifier: string; count: number; remaining: number; blockedUntil?: Date }[] {
    const prefix = `${endpointId}:`;
    const now    = Date.now();
    const result = [];
    for (const [key, entry] of this.rlStore) {
      if (!key.startsWith(prefix)) continue;
      const identifier = key.substring(prefix.length);
      const valid = entry.timestamps.filter(t => now - t < 60000); // show last 60s
      result.push({
        identifier,
        count: valid.length,
        remaining: 0,
        blockedUntil: entry.blockedUntil ? new Date(entry.blockedUntil) : undefined,
      });
    }
    return result;
  }

  // ── Admin operations ──────────────────────────────────────────────────────
  unblockIdentifier(endpointId: string, identifier: string): boolean {
    const key = `${endpointId}:${identifier}`;
    const entry = this.rlStore.get(key);
    if (!entry) return false;
    entry.blockedUntil  = undefined;
    entry.timestamps    = [];
    return true;
  }

  clearRateLimits(endpointId?: string): void {
    if (endpointId) {
      for (const key of this.rlStore.keys()) {
        if (key.startsWith(`${endpointId}:`)) this.rlStore.delete(key);
      }
    } else {
      this.rlStore.clear();
    }
  }

  // ── Maintenance ───────────────────────────────────────────────────────────
  private purgeRLStore(): void {
    const now = Date.now();
    let purged = 0;
    for (const [key, entry] of this.rlStore) {
      const maxWindow = 3600 * 1000; // 1h max window
      entry.timestamps = entry.timestamps.filter(t => now - t < maxWindow);
      if (!entry.timestamps.length && (!entry.blockedUntil || now > entry.blockedUntil)) {
        this.rlStore.delete(key); purged++;
      }
    }
    if (purged) this.logger.debug(`RL store purge: ${purged} expired entries removed`);
  }

  private sortObj(obj: Record<string, any>): Record<string, any> {
    if (!obj || typeof obj !== 'object') return obj;
    return Object.keys(obj).sort().reduce((acc, k) => { acc[k] = obj[k]; return acc; }, {} as any);
  }
}
