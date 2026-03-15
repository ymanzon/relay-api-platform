import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApiEndpoint, ApiEndpointSchema } from './schemas/endpoint.schema';
import { EndpointsController } from './endpoints.controller';
import { EndpointsService } from './endpoints.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ApiEndpoint.name, schema: ApiEndpointSchema }]),
  ],
  controllers: [EndpointsController],
  providers: [EndpointsService],
  exports: [EndpointsService],
})
export class EndpointsModule {}
