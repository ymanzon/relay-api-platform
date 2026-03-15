import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SecurityEvent, SecurityEventSchema } from './security-event.schema';
import { SecurityService } from './security.service';
import { SecurityController } from './security.controller';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([{ name: SecurityEvent.name, schema: SecurityEventSchema }]),
  ],
  providers:   [SecurityService],
  controllers: [SecurityController],
  exports:     [SecurityService],
})
export class SecurityModule {}
