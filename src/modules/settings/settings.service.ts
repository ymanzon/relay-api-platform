import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppSettings, SettingsDocument, Theme } from './settings.schema';

export const THEMES: Record<Theme, Record<string, string>> = {
  [Theme.DARK]: {
    '--bg-dark':    '#0d0f14', '--bg-card':    '#151820', '--bg-surface': '#1c202b',
    '--border':     '#2a2f3d', '--accent':     '#00e5a0', '--accent-dim': 'rgba(0,229,160,.12)',
    '--accent2':    '#7c6fff', '--accent2-dim':'rgba(124,111,255,.12)',
    '--warn':       '#ff9f43', '--danger':     '#ff6b6b',
    '--text-1':     '#e8eaf0', '--text-2':     '#9099b0', '--text-3':     '#555f78',
  },
  [Theme.LIGHT]: {
    '--bg-dark':    '#f0f2f5', '--bg-card':    '#ffffff', '--bg-surface': '#f8f9fb',
    '--border':     '#dde1ea', '--accent':     '#00b87a', '--accent-dim': 'rgba(0,184,122,.1)',
    '--accent2':    '#6c5ce7', '--accent2-dim':'rgba(108,92,231,.1)',
    '--warn':       '#e67e22', '--danger':     '#e74c3c',
    '--text-1':     '#1a1d26', '--text-2':     '#4a5568', '--text-3':     '#8a94a6',
  },
  [Theme.MIDNIGHT]: {
    '--bg-dark':    '#060810', '--bg-card':    '#0e1117', '--bg-surface': '#141720',
    '--border':     '#1e2436', '--accent':     '#00cfff', '--accent-dim': 'rgba(0,207,255,.12)',
    '--accent2':    '#a855f7', '--accent2-dim':'rgba(168,85,247,.12)',
    '--warn':       '#fbbf24', '--danger':     '#f87171',
    '--text-1':     '#e2e8f0', '--text-2':     '#7c8fa8', '--text-3':     '#3d4a60',
  },
  [Theme.FOREST]: {
    '--bg-dark':    '#0a0f0a', '--bg-card':    '#111811', '--bg-surface': '#182018',
    '--border':     '#253025', '--accent':     '#4ade80', '--accent-dim': 'rgba(74,222,128,.12)',
    '--accent2':    '#f59e0b', '--accent2-dim':'rgba(245,158,11,.12)',
    '--warn':       '#fb923c', '--danger':     '#f87171',
    '--text-1':     '#ecfdf5', '--text-2':     '#86a897', '--text-3':     '#4a6454',
  },
  [Theme.SOLARIZED]: {
    '--bg-dark':    '#002b36', '--bg-card':    '#073642', '--bg-surface': '#0a3d4a',
    '--border':     '#14505f', '--accent':     '#2aa198', '--accent-dim': 'rgba(42,161,152,.15)',
    '--accent2':    '#6c71c4', '--accent2-dim':'rgba(108,113,196,.15)',
    '--warn':       '#b58900', '--danger':     '#dc322f',
    '--text-1':     '#fdf6e3', '--text-2':     '#93a1a1', '--text-3':     '#586e75',
  },
};

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(AppSettings.name)
    private readonly model: Model<SettingsDocument>,
  ) {}

  async get(): Promise<AppSettings> {
    let doc = await this.model.findOne({ key: 'global' }).exec();
    if (!doc) doc = await this.model.create({ key: 'global' });
    return doc;
  }

  async update(dto: Partial<AppSettings>): Promise<AppSettings> {
    return this.model.findOneAndUpdate(
      { key: 'global' },
      { $set: dto },
      { upsert: true, new: true },
    ).exec();
  }

  getThemeVars(theme: Theme): Record<string, string> {
    return THEMES[theme] || THEMES[Theme.DARK];
  }

  getAllThemes(): { id: Theme; label: string; preview: string }[] {
    return [
      { id: Theme.DARK,      label: 'Dark',      preview: '#0d0f14' },
      { id: Theme.LIGHT,     label: 'Light',     preview: '#ffffff' },
      { id: Theme.MIDNIGHT,  label: 'Midnight',  preview: '#060810' },
      { id: Theme.FOREST,    label: 'Forest',    preview: '#0a0f0a' },
      { id: Theme.SOLARIZED, label: 'Solarized', preview: '#002b36' },
    ];
  }
}
