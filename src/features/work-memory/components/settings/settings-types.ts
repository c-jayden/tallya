import type { AppTheme } from '../../services/app-settings-repository';
import type { ProviderHealth } from '../../services/ai/ai-provider';
import type { ReportFocus, ReportLength, ReportTone } from '../../types';

export type SettingsSection = 'ai' | 'notifications' | 'reports' | 'app' | 'data' | 'about';

export type { ProviderHealth };

export const defaultSettingsSection: SettingsSection = 'app';

export const menuItems: { id: SettingsSection; label: string }[] = [
  { id: 'app', label: '应用设置' },
  { id: 'ai', label: 'AI 配置' },
  { id: 'reports', label: '报告偏好' },
  { id: 'notifications', label: '通知提醒' },
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

export const reportLengthOptions: { value: ReportLength; label: string }[] = [
  { value: 'brief', label: '精简' },
  { value: 'standard', label: '标准' },
  { value: 'detailed', label: '详细' },
];

export const reportToneOptions: { value: ReportTone; label: string }[] = [
  { value: 'natural', label: '自然' },
  { value: 'formal', label: '正式' },
  { value: 'retrospective', label: '复盘型' },
];

export const reportFocusOptions: { value: ReportFocus; label: string }[] = [
  { value: 'outcomes', label: '关键产出优先' },
  { value: 'completed-items', label: '完成事项优先' },
  { value: 'risks', label: '问题风险优先' },
];
