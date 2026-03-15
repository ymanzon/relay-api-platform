import { Controller, Get, Put, Body } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { Theme } from './settings.schema';

@Controller('catalog/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  get() { return this.settingsService.get(); }

  @Get('themes')
  themes() { return this.settingsService.getAllThemes(); }

  @Get('themes/:id/vars')
  themeVars() { return {}; } // handled by get() + client

  @Put()
  update(@Body() dto: { theme?: Theme; historyMaxRows?: number }) {
    return this.settingsService.update(dto);
  }
}
