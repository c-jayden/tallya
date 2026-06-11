import type { AppTheme } from '../../services/app-settings-repository';
import type { ProviderHealth } from '../../services/ai/ai-provider';
import type { ReportFocus, ReportLength, ReportTone } from '../../types';

export type SettingsSection =
  | 'app'
  | 'ai'
  | 'reports'
  | 'notifications'
  | 'shortcuts'
  | 'data'
  | 'about';

export type { ProviderHealth };

export const defaultSettingsSection: SettingsSection = 'app';

export const menuItems: { id: SettingsSection; label: string }[] = [
  { id: 'app', label: '应用偏好' },
  { id: 'ai', label: 'AI 服务' },
  { id: 'reports', label: '整理偏好' },
  { id: 'notifications', label: '提醒' },
  { id: 'shortcuts', label: '快捷键' },
  { id: 'data', label: '本地数据' },
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
  { value: 'brief', label: '简短一点' },
  { value: 'standard', label: '适中' },
  { value: 'detailed', label: '多留细节' },
];

export const reportToneOptions: { value: ReportTone; label: string }[] = [
  { value: 'natural', label: '自然' },
  { value: 'formal', label: '稳重' },
  { value: 'retrospective', label: '偏复盘' },
];

export const reportFocusOptions: { value: ReportFocus; label: string }[] = [
  { value: 'outcomes', label: '关键产出' },
  { value: 'completed-items', label: '完成事项' },
  { value: 'risks', label: '问题与风险' },
];
