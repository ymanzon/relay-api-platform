import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { Secret, SecretDocument } from './secret.schema';

// ── Encryption helpers ────────────────────────────────────────────────────────
// Key is derived from env or a dev default. In production set SECRET_ENCRYPTION_KEY
// to a 32-byte (64-char hex) random value.
function getEncKey(): Buffer {
  const raw = process.env.SECRET_ENCRYPTION_KEY || '';
  if (raw.length === 64) return Buffer.from(raw, 'hex');
  // Dev fallback: derive a stable key from a constant string
  return crypto.createHash('sha256').update('relay-dev-secret-key').digest();
}

function encrypt(plaintext: string): { encryptedValue: string; iv: string; authTag: string } {
  const key = getEncKey();
  const iv  = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc  = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    encryptedValue: enc.toString('hex'),
    iv:             iv.toString('hex'),
    authTag:        cipher.getAuthTag().toString('hex'),
  };
}

function decrypt(encryptedValue: string, iv: string, authTag: string): string {
  const key     = getEncKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncKey(), Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  const dec = Buffer.concat([decipher.update(Buffer.from(encryptedValue, 'hex')), decipher.final()]);
  return dec.toString('utf8');
}

// ── Reference resolution ──────────────────────────────────────────────────────
const SECRET_REF_RE = /\{\{([A-Z0-9_]+)\}\}/g;

export interface SecretPublicView {
  _id:          string;
  name:         string;
  description?: string;
  type:         string;
  masked:       string;         // "••••••••" — never the real value
  usageCount:   number;
  lastUsedAt?:  Date;
  referencedBy: string[];
  createdAt:    Date;
  updatedAt:    Date;
}

@Injectable()
export class SecretsService {
  private readonly logger = new Logger(SecretsService.name);
  /** In-memory cache: name → decrypted value. Invalidated on write. */
  private cache = new Map<string, string>();

  constructor(
    @InjectModel(Secret.name) private readonly model: Model<SecretDocument>,
  ) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────
  async create(dto: { name: string; value: string; description?: string; type?: string }): Promise<SecretPublicView> {
    const name = dto.name.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    const existing = await this.model.findOne({ name }).exec();
    if (existing) throw new BadRequestException(`Secret "${name}" already exists`);

    const { encryptedValue, iv, authTag } = encrypt(dto.value);
    const doc = await new this.model({ name, description: dto.description, type: dto.type || 'other', encryptedValue, iv, authTag }).save();
    this.cache.delete(name);
    return this.toPublicView(doc);
  }

  async findAll(): Promise<SecretPublicView[]> {
    const docs = await this.model.find().sort({ name: 1 }).lean().exec();
    return docs.map(d => this.toPublicView(d as any));
  }

  async findOne(id: string): Promise<SecretPublicView> {
    const doc = await this.model.findById(id).lean().exec();
    if (!doc) throw new NotFoundException(`Secret ${id} not found`);
    return this.toPublicView(doc as any);
  }

  async update(id: string, dto: { value?: string; description?: string; type?: string; name?: string }): Promise<SecretPublicView> {
    const doc = await this.model.findById(id).exec();
    if (!doc) throw new NotFoundException(`Secret ${id} not found`);

    if (dto.value) {
      const { encryptedValue, iv, authTag } = encrypt(dto.value);
      doc.encryptedValue = encryptedValue;
      doc.iv             = iv;
      doc.authTag        = authTag;
      this.cache.delete(doc.name);
    }
    if (dto.description !== undefined) doc.description = dto.description;
    if (dto.type)        doc.type        = dto.type;
    await doc.save();
    return this.toPublicView(doc);
  }

  async remove(id: string): Promise<void> {
    const doc = await this.model.findByIdAndDelete(id).exec();
    if (doc) this.cache.delete(doc.name);
  }

  /** Update which endpoints reference this secret (called from endpoints service) */
  async updateReferences(secretName: string, endpointId: string, add: boolean): Promise<void> {
    await this.model.updateOne(
      { name: secretName },
      add
        ? { $addToSet: { referencedBy: endpointId } }
        : { $pull:     { referencedBy: endpointId } },
    ).exec();
  }

  // ── Resolution (used by ProxyService) ────────────────────────────────────
  /**
   * Resolves all {{SECRET_NAME}} placeholders in a string.
   * Returns the resolved string. Throws if a referenced secret is not found.
   * Also increments usageCount for each resolved secret (debounced to avoid per-request writes).
   */
  async resolveString(input: string): Promise<string> {
    if (!input || !input.includes('{{')) return input;

    const names = new Set<string>();
    let match: RegExpExecArray | null;
    // reset lastIndex
    SECRET_REF_RE.lastIndex = 0;
    while ((match = SECRET_REF_RE.exec(input)) !== null) names.add(match[1]);

    if (!names.size) return input;

    // Build resolution map
    const resolved = new Map<string, string>();
    for (const name of names) {
      const value = await this.resolveByName(name);
      resolved.set(name, value);
    }

    return input.replace(SECRET_REF_RE, (_, name) => resolved.get(name) ?? `{{${name}}}`);
  }

  /**
   * Resolves all {{SECRET_NAME}} in an entire headers object.
   * Returns a new object with resolved values (original not mutated).
   */
  async resolveHeaders(headers: Record<string, string>): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers || {})) {
      result[k] = await this.resolveString(v);
    }
    return result;
  }

  /**
   * Builds a read-only ctx.secrets proxy for script execution.
   * Accessing ctx.secrets.MY_KEY returns the plain value synchronously
   * (pre-loaded before script runs).
   */
  async buildSecretsProxy(names?: string[]): Promise<Record<string, string>> {
    // If specific names given, load only those; else load all
    if (names?.length) {
      const map: Record<string, string> = {};
      for (const n of names) {
        try { map[n] = await this.resolveByName(n); } catch { map[n] = ''; }
      }
      return Object.freeze(map);
    }
    // Load all secrets for scripts that iterate
    const docs = await this.model.find().lean().exec();
    const map: Record<string, string> = {};
    for (const d of docs) {
      try { map[d.name] = decrypt(d.encryptedValue, d.iv, d.authTag); } catch {}
    }
    return Object.freeze(map);
  }

  /** Get all secret names referenced in a string (for building proxy upfront) */
  extractNames(input: string): string[] {
    const names: string[] = [];
    SECRET_REF_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = SECRET_REF_RE.exec(input)) !== null) names.push(m[1]);
    return names;
  }

  /** Validate that all {{SECRET_NAME}} refs in headers/url exist */
  async validateRefs(strings: string[]): Promise<{ missing: string[] }> {
    const allNames = (await this.model.find().select('name').lean().exec()).map((d: any) => d.name);
    const nameSet  = new Set(allNames);
    const missing  = new Set<string>();
    for (const s of strings) {
      for (const n of this.extractNames(s)) {
        if (!nameSet.has(n)) missing.add(n);
      }
    }
    return { missing: [...missing] };
  }

  // ── Private ───────────────────────────────────────────────────────────────
  private async resolveByName(name: string): Promise<string> {
    if (this.cache.has(name)) {
      // Still bump usage async
      this.bumpUsage(name).catch(() => {});
      return this.cache.get(name)!;
    }
    const doc = await this.model.findOne({ name }).exec();
    if (!doc) throw new Error(`Secret "{{${name}}}" not found — create it in the Secrets module`);
    const value = decrypt(doc.encryptedValue, doc.iv, doc.authTag);
    this.cache.set(name, value);
    this.bumpUsage(name).catch(() => {});
    return value;
  }

  private async bumpUsage(name: string): Promise<void> {
    await this.model.updateOne({ name }, { $inc: { usageCount: 1 }, $set: { lastUsedAt: new Date() } }).exec();
  }

  private toPublicView(doc: any): SecretPublicView {
    return {
      _id:         doc._id.toString(),
      name:        doc.name,
      description: doc.description,
      type:        doc.type || 'other',
      masked:      '••••••••',  // NEVER expose value
      usageCount:  doc.usageCount || 0,
      lastUsedAt:  doc.lastUsedAt,
      referencedBy: doc.referencedBy || [],
      createdAt:   doc.createdAt,
      updatedAt:   doc.updatedAt,
    };
  }
}
