import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

interface CacheEntry {
  value: any;
  expiresAt: number;
  hits: number;
  createdAt: number;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly store  = new Map<string, CacheEntry>();
  private readonly MAX_ENTRIES = 1000;

  /**
   * Build a deterministic cache key from endpointId + sorted query + sorted body.
   * ignoreBody = true for GET endpoints (body irrelevant).
   */
  buildKey(endpointId: string, query: Record<string, any>, body: Record<string, any>, ignoreBody = false): string {
    const q = JSON.stringify(this.sortObj(query));
    const b = ignoreBody ? '' : JSON.stringify(this.sortObj(body));
    return createHash('sha1').update(`${endpointId}::${q}::${b}`).digest('hex');
  }

  get(key: string): { hit: true; value: any; age: number } | { hit: false } {
    const entry = this.store.get(key);
    if (!entry) return { hit: false };
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return { hit: false };
    }
    entry.hits++;
    return { hit: true, value: entry.value, age: Date.now() - entry.createdAt };
  }

  set(key: string, value: any, ttlSeconds: number): void {
    // Evict oldest if at capacity
    if (this.store.size >= this.MAX_ENTRIES) {
      const oldest = [...this.store.entries()]
        .sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
      if (oldest) this.store.delete(oldest[0]);
    }
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
      hits: 0,
      createdAt: Date.now(),
    });
  }

  invalidateEndpoint(endpointId: string): number {
    // We can't easily map endpointId → keys since key is a hash, so we use a tag prefix approach
    // Instead, store a secondary set of keys per endpointId
    let count = 0;
    for (const [key] of this.store) {
      if (key.startsWith(`ep:${endpointId}:`)) { this.store.delete(key); count++; }
    }
    return count;
  }

  buildTaggedKey(endpointId: string, query: Record<string, any>, body: Record<string, any>, ignoreBody = false): string {
    const hash = this.buildKey(endpointId, query, body, ignoreBody);
    return `ep:${endpointId}:${hash}`;
  }

  stats(): { size: number; entries: { key: string; hits: number; ttlRemaining: number }[] } {
    const now = Date.now();
    return {
      size: this.store.size,
      entries: [...this.store.entries()].map(([k, v]) => ({
        key: k.substring(0, 20) + '…',
        hits: v.hits,
        ttlRemaining: Math.max(0, Math.round((v.expiresAt - now) / 1000)),
      })),
    };
  }

  clear(): void { this.store.clear(); }

  private sortObj(obj: Record<string, any>): Record<string, any> {
    if (!obj || typeof obj !== 'object') return obj;
    return Object.keys(obj).sort().reduce((acc, k) => { acc[k] = obj[k]; return acc; }, {} as any);
  }
}
