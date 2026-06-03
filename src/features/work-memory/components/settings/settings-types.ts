import type { AppTheme } from '../../services/app-settings-repository';
import type { ProviderHealth } from '../../services/ai/ai-provider';

export type SettingsSection = 'ai' | 'notifications' | 'app' | 'data' | 'about';

export type { ProviderHealth };

export type TestResult =
  | { type: 'idle' }
  | { type: 'success'; summary: string }
  | { type: 'error'; message: string };

export const menuItems: { id: SettingsSection; label: string }[] = [
  { id: 'ai', label: 'AI 配置' },
  { id: 'notifications', label: '通知提醒' },
  { id: 'app', label: '应用设置' },
  { id: 'data', label: '数据管理' },
  { id: 'about', label: '关于' },
];

export const weekdays = [
  { value: 'monday', label: '周一' },
  { value: 'tuesday', label: '周二' },
  { value: 'wednesday', label: '周三' },
  { value: 'thursday', label: '周四' },
  { value: 'friday', label: '周五' },
  { value: 'saturday', label: '周六' },
  { value: 'sunday', label: '周日' },
];

export const themeOptions: { value: AppTheme; label: string }[] = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
];

export const testMemoryInput = '今天整理了需求讨论内容，确认了优先处理范围，并同步了后续计划。';
