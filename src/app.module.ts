import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { existsSync } from 'fs';
import { EndpointsModule } from './modules/endpoints/endpoints.module';
import { EventsModule } from './modules/events/events.module';
import { ProxyModule } from './modules/proxy/proxy.module';
import { ExecutionsModule } from './modules/executions/executions.module';
import { SettingsModule } from './modules/settings/settings.module';
import { AppCacheModule } from './modules/cache/cache.module';
import { SecretsModule } from './modules/secrets/secrets.module';
import { SecurityModule } from './modules/security/security.module';
import { EnvironmentsModule } from './modules/environments/environments.module';
import { ImportModule } from './modules/import/import.module';

const devPublic  = join(process.cwd(), 'src', 'public');
const prodPublic = join(__dirname, '..', 'public');
const publicPath = existsSync(devPublic) ? devPublic : prodPublic;

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/api-catalog'),
    ServeStaticModule.forRoot({ rootPath: publicPath, exclude: ['/api*', '/catalog*'] }),
    AppCacheModule,
    SecretsModule,       // ← Global, registers first so ProxyService can inject it
    SecurityModule,      // ← Global security pipeline
    EnvironmentsModule,  // ← Global env vars resolution
    ImportModule,        // ← OpenAPI/Swagger import
    EndpointsModule,
    EventsModule,
    ExecutionsModule,
    SettingsModule,
    ProxyModule,
  ],
})
export class AppModule {}
