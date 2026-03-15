import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Environment, EnvironmentSchema } from './environment.schema';
import { EnvironmentsService } from './environments.service';
import { EnvironmentsController } from './environments.controller';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Environment.name, schema: EnvironmentSchema }]),
  ],
  providers:   [EnvironmentsService],
  controllers: [EnvironmentsController],
  exports:     [EnvironmentsService],
})
export class EnvironmentsModule {}
