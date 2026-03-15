import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Secret, SecretSchema } from './secret.schema';
import { SecretsService } from './secrets.service';
import { SecretsController } from './secrets.controller';

@Global()   // ← Global so ProxyService / EventsService can inject SecretsService
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Secret.name, schema: SecretSchema }]),
  ],
  providers:   [SecretsService],
  controllers: [SecretsController],
  exports:     [SecretsService],
})
export class SecretsModule {}
