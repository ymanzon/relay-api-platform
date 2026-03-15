import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppSettings, AppSettingsSchema } from './settings.schema';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: AppSettings.name, schema: AppSettingsSchema }])],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
