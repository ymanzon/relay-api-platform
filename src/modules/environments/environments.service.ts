import { Injectable, NotFoundException, Global } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Environment, EnvironmentDocument } from './environment.schema';

// Matches [[VAR_NAME]] — brackets distinguish from {{SECRET}} syntax
const ENV_REF_RE = /\[\[([A-Z0-9_]+)\]\]/g;

@Injectable()
export class EnvironmentsService {
  constructor(
    @InjectModel(Environment.name) private readonly envModel: Model<EnvironmentDocument>,
  ) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async findAll(): Promise<Environment[]> {
    return this.envModel.find().sort({ isActive: -1, name: 1 }).lean().exec();
  }

  async findOne(id: string): Promise<Environment> {
    const env = await this.envModel.findById(id).lean().exec();
    if (!env) throw new NotFoundException(`Environment ${id} not found`);
    return env;
  }

  async create(dto: { name: string; description?: string; variables?: any[]; color?: string }): Promise<Environment> {
    return new this.envModel(dto).save();
  }

  async update(id: string, dto: Partial<{ name: string; description: string; variables: any[]; color: string }>): Promise<Environment> {
    const env = await this.envModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true, runValidators: false })
      .lean().exec();
    if (!env) throw new NotFoundException(`Environment ${id} not found`);
    return env;
  }

  async remove(id: string): Promise<void> {
    const r = await this.envModel.findByIdAndDelete(id).exec();
    if (!r) throw new NotFoundException(`Environment ${id} not found`);
  }

  // ── Active environment ────────────────────────────────────────────────────

  async setActive(id: string): Promise<Environment> {
    // Deactivate all, then activate the one
    await this.envModel.updateMany({}, { $set: { isActive: false } }).exec();
    const env = await this.envModel
      .findByIdAndUpdate(id, { $set: { isActive: true } }, { new: true })
      .lean().exec();
    if (!env) throw new NotFoundException(`Environment ${id} not found`);
    return env;
  }

  async deactivateAll(): Promise<void> {
    await this.envModel.updateMany({}, { $set: { isActive: false } }).exec();
  }

  async getActive(): Promise<Environment | null> {
    return this.envModel.findOne({ isActive: true }).lean().exec();
  }

  // ── Variable resolution ───────────────────────────────────────────────────

  /**
   * Build a flat variable map from the active environment.
   * Returns empty map if no environment is active.
   */
  async buildVarMap(): Promise<Record<string, string>> {
    const env = await this.getActive();
    if (!env?.variables?.length) return {};
    return (env.variables as any[]).reduce((map, v) => {
      if (v.key?.trim()) map[v.key.trim()] = v.value ?? '';
      return map;
    }, {} as Record<string, string>);
  }

  /**
   * Resolve [[VAR_NAME]] placeholders in a string using the active environment.
   * Unknown variables are left as-is (not replaced).
   */
  resolveString(input: string, varMap: Record<string, string>): string {
    if (!input || !input.includes('[[')) return input;
    ENV_REF_RE.lastIndex = 0;
    return input.replace(ENV_REF_RE, (_, key) =>
      Object.prototype.hasOwnProperty.call(varMap, key) ? varMap[key] : `[[${key}]]`
    );
  }

  resolveHeaders(
    headers: Record<string, string>,
    varMap: Record<string, string>,
  ): Record<string, string> {
    return Object.fromEntries(
      Object.entries(headers).map(([k, v]) => [k, this.resolveString(v, varMap)])
    );
  }

  extractVarNames(input: string): string[] {
    const names: string[] = [];
    ENV_REF_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = ENV_REF_RE.exec(input)) !== null) names.push(m[1]);
    return names;
  }

  // ── Preview / validate ────────────────────────────────────────────────────

  async previewResolution(
    envId: string | null,
    inputs: { url: string; headers: Record<string, string> }
  ): Promise<{ resolved: typeof inputs; unresolvedVars: string[] }> {
    let varMap: Record<string, string> = {};
    if (envId) {
      const env = await this.envModel.findById(envId).lean().exec();
      if (env) {
        varMap = (env.variables as any[]).reduce((m, v) => {
          if (v.key?.trim()) m[v.key.trim()] = v.value ?? '';
          return m;
        }, {} as Record<string, string>);
      }
    }

    const resolvedUrl     = this.resolveString(inputs.url, varMap);
    const resolvedHeaders = this.resolveHeaders(inputs.headers, varMap);

    // Find still-unresolved [[VAR]] references
    const unresolvedVars: string[] = [
      ...this.extractVarNames(resolvedUrl),
      ...Object.values(resolvedHeaders).flatMap(v => this.extractVarNames(v)),
    ];

    return {
      resolved: { url: resolvedUrl, headers: resolvedHeaders },
      unresolvedVars: [...new Set(unresolvedVars)],
    };
  }
}
