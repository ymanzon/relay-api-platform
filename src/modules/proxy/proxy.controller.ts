import { Controller, All, Req, Res, Param, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { ProxyService } from './proxy.service';

@Controller('api')
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @All(':path(*)')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } })) // 100MB max
  async handleProxy(
    @Param('path') path: string,
    @Req()  req: Request,
    @Res()  res: Response,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    // Resolve real client IP through reverse proxy headers
    const clientIp = (
      (req.headers['x-forwarded-for'] as string || '').split(',')[0].trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.socket?.remoteAddress ||
      '0.0.0.0'
    ).replace(/^::ffff:/, ''); // normalize IPv4-mapped IPv6

    const bodyRawSize = req.headers['content-length']
      ? parseInt(req.headers['content-length'] as string, 10)
      : Buffer.byteLength(JSON.stringify(req.body || {}), 'utf8');

    const result = await this.proxyService.handle({
      path, method: req.method,
      query:   req.query   as Record<string, any>,
      body:    req.body    || {},
      headers: req.headers as Record<string, any>,
      params:  req.params,
      clientIp,
      bodyRawSize,
      file: file ? {
        buffer:       file.buffer,
        originalname: file.originalname,
        mimetype:     file.mimetype,
        size:         file.size,
      } : undefined,
    });

    // Set headers
    Object.entries(result.headers || {}).forEach(([k, v]) => res.setHeader(k, v));
    if (result.meta) {
      res.setHeader('X-Catalog-Duration-Ms', result.meta.totalDurationMs);
      res.setHeader('X-Catalog-Mode',        result.meta.mode);
      if (result.meta.cacheHit) res.setHeader('X-Cache', 'HIT');
    }

    // File download response
    if (result.fileBuffer && result.fileInfo) {
      res.setHeader('Content-Type',        result.fileInfo.mime);
      res.setHeader('Content-Disposition', `attachment; filename="${result.fileInfo.name}"`);
      res.setHeader('Content-Length',      result.fileBuffer.length);
      res.status(result.statusCode).end(result.fileBuffer);
      return;
    }

    // Apply CORS headers from security config if present
    if (result.meta?.securityHeaders) {
      Object.entries(result.meta.securityHeaders).forEach(([k, v]) => res.setHeader(k, v));
    }

    // OPTIONS preflight — respond immediately
    if (req.method === 'OPTIONS') {
      res.status(204).end(); return;
    }

    res.status(result.statusCode).json(
      result.meta
        ? { data: result.body, _meta: result.meta }
        : result.body,
    );
  }
}
