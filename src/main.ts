import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  // Load .env manually (no @nestjs/config to keep deps minimal)
  try {
    const fs = require('fs');
    const path = require('path');
    const envFile = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envFile)) {
      const lines = fs.readFileSync(envFile, 'utf8').split('\n');
      for (const line of lines) {
        const [key, ...rest] = line.split('=');
        if (key?.trim() && !process.env[key.trim()]) {
          process.env[key.trim()] = rest.join('=').trim();
        }
      }
    }
  } catch {}

  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  app.enableCors({ origin: '*' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen(port);
  console.log(`\n🚀 API Catalog running on http://localhost:${port}`);
  console.log(`📋 Dashboard:     http://localhost:${port}`);
  console.log(`🔗 Catalog API:   http://localhost:${port}/catalog/endpoints`);
  console.log(`⚡ Proxy engine:  http://localhost:${port}/api/{virtualPath}\n`);
}

bootstrap();
