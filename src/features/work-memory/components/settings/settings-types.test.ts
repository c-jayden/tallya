import { describe, expect, it } from 'vitest';
import { defaultSettingsSection, menuItems } from './settings-types';

describe('settings menu order', () => {
  it('opens settings from application preferences first', () => {
    expect(defaultSettingsSection).toBe('app');
    expect(menuItems.map((item) => item.id)).toEqual([
      'app',
      'ai',
      'reports',
      'notifications',
      'data',
      'about',
    ]);
  });
});
