import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApiExecution, ApiExecutionSchema } from './execution.schema';
import { ExecutionsController } from './executions.controller';
import { ExecutionsService } from './executions.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: ApiExecution.name, schema: ApiExecutionSchema }])],
  controllers: [ExecutionsController],
  providers: [ExecutionsService],
  exports: [ExecutionsService],
})
export class ExecutionsModule {}
