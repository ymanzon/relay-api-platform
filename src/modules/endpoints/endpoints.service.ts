import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiEndpoint, EndpointDocument } from './schemas/endpoint.schema';
import { CreateEndpointDto } from './dto/create-endpoint.dto';
import { UpdateEndpointDto } from './dto/update-endpoint.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class EndpointsService {
  constructor(
    @InjectModel(ApiEndpoint.name) private endpointModel: Model<EndpointDocument>,
  ) {}

  generateApiKey(length = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = randomBytes(length * 2);
    let result = '';
    for (let i = 0; i < bytes.length && result.length < length; i++) {
      result += chars[bytes[i] % chars.length];
    }
    return result;
  }

  async create(dto: CreateEndpointDto): Promise<ApiEndpoint> {
    const existing = await this.endpointModel.findOne({ virtualPath: dto.virtualPath }).exec();
    if (existing) throw new ConflictException(`Virtual path "${dto.virtualPath}" already exists`);
    if (dto.requireApiKey && !dto.apiKey) dto.apiKey = this.generateApiKey(dto.apiKeyLength || 32);
    return new this.endpointModel(dto).save();
  }

  async findAll(filters?: { enabled?: boolean; tags?: string[]; collection?: string }): Promise<ApiEndpoint[]> {
    const q: any = {};
    if (filters?.enabled !== undefined) q.enabled = filters.enabled;
    if (filters?.tags?.length) q.tags = { $in: filters.tags };
    if (filters?.collection !== undefined) q.collection = filters.collection;
    return this.endpointModel.find(q).populate('preEvents').populate('postEvents')
      .sort({ collection: 1, order: 1, createdAt: -1 }).exec();
  }

  async findOne(id: string): Promise<ApiEndpoint> {
    const ep = await this.endpointModel.findById(id).populate('preEvents').populate('postEvents').exec();
    if (!ep) throw new NotFoundException(`Endpoint ${id} not found`);
    return ep;
  }

  async findByPath(virtualPath: string, method: string): Promise<EndpointDocument | null> {
    return this.endpointModel
      .findOne({ virtualPath, method: method.toUpperCase(), enabled: true })
      .populate('preEvents').populate('postEvents').exec();
  }

  async update(id: string, dto: UpdateEndpointDto): Promise<ApiEndpoint> {
    if (dto.virtualPath) {
      const clash = await this.endpointModel.findOne({ virtualPath: dto.virtualPath, _id: { $ne: id } }).exec();
      if (clash) throw new ConflictException(`Virtual path "${dto.virtualPath}" already exists`);
    }
    if (dto.requireApiKey && !dto.apiKey) dto.apiKey = this.generateApiKey(dto.apiKeyLength || 32);

    // Explicit $set with a plain object — required in Mongoose 8 for { type: Object }
    // (Mixed-type) subdocuments like securityConfig to be persisted via findByIdAndUpdate
    const plainUpdate: Record<string, any> = {};
    for (const key of Object.keys(dto) as (keyof UpdateEndpointDto)[]) {
      if ((dto as any)[key] !== undefined) plainUpdate[key] = (dto as any)[key];
    }

    const ep = await this.endpointModel
      .findByIdAndUpdate(id, { $set: plainUpdate }, { new: true, runValidators: false })
      .populate('preEvents').populate('postEvents').exec();
    if (!ep) throw new NotFoundException(`Endpoint ${id} not found`);
    return ep;
  }

  async remove(id: string): Promise<void> {
    const r = await this.endpointModel.findByIdAndDelete(id).exec();
    if (!r) throw new NotFoundException(`Endpoint ${id} not found`);
  }

  async generateKeyForEndpoint(id: string, length = 32): Promise<{ apiKey: string }> {
    const key = this.generateApiKey(length);
    await this.endpointModel.findByIdAndUpdate(id, { apiKey: key, requireApiKey: true }).exec();
    return { apiKey: key };
  }

  /** Return sorted unique collection names */
  async getCollections(): Promise<{ name: string; count: number }[]> {
    const res = await this.endpointModel.aggregate([
      { $group: { _id: '$collection', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]).exec();
    return res.map(r => ({ name: r._id || '', count: r.count }));
  }

  /** Move a batch of endpoints to a collection (or '' to ungroup) */
  async bulkSetCollection(ids: string[], collection: string): Promise<{ modified: number }> {
    const res = await this.endpointModel.updateMany(
      { _id: { $in: ids } },
      { $set: { collection: collection || '' } },
    ).exec();
    return { modified: res.modifiedCount };
  }

  async getStats(): Promise<any> {
    const total    = await this.endpointModel.countDocuments().exec();
    const enabled  = await this.endpointModel.countDocuments({ enabled: true }).exec();
    const secured  = await this.endpointModel.countDocuments({ requireApiKey: true }).exec();
    const withMock = await this.endpointModel.countDocuments({ $or: [{ destinationUrl: null }, { destinationUrl: '' }] }).exec();
    const byMethod = await this.endpointModel.aggregate([{ $group: { _id: '$method', count: { $sum: 1 } } }]).exec();
    const byCol    = await this.endpointModel.aggregate([{ $group: { _id: '$collection', count: { $sum: 1 } } }]).exec();
    return {
      total, enabled, disabled: total - enabled,
      withMock, withDestination: total - withMock, secured,
      byMethod: byMethod.reduce((a, i) => { a[i._id] = i.count; return a; }, {}),
      collections: byCol.length,
    };
  }
}
