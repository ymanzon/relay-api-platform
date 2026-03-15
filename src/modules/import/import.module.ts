import { Module } from '@nestjs/common';
import { ImportService } from './import.service';
import { ImportController } from './import.controller';
import { EndpointsModule } from '../endpoints/endpoints.module';

@Module({
  imports:     [EndpointsModule],
  providers:   [ImportService],
  controllers: [ImportController],
})
export class ImportModule {}
