import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_APP_SETTINGS } from '../app-settings-repository';
import {
  ReminderService,
  getNextDailyReminderAt,
  getNextWeeklyReminderAt,
} from '../reminder-service';

describe('reminder time calculation', () => {
  it('returns today when the daily reminder time is still in the future', () => {
    const now = new Date('2026-06-03T17:30:00');

    expect(getNextDailyReminderAt(now, '18:00')).toEqual(new Date('2026-06-03T18:00:00'));
  });

  it('returns tomorrow when the daily reminder time has passed', () => {
    const now = new Date('2026-06-03T18:01:00');

    expect(getNextDailyReminderAt(now, '18:00')).toEqual(new Date('2026-06-04T18:00:00'));
  });

  it('returns the current week when the weekly reminder time is still in the future', () => {
    const now = new Date('2026-06-03T12:00:00');

    expect(getNextWeeklyReminderAt(now, 'friday', '18:30')).toEqual(
      new Date('2026-06-05T18:30:00'),
    );
  });

  it('returns the next week when the weekly reminder time has passed', () => {
    const now = new Date('2026-06-05T18:31:00');

    expect(getNextWeeklyReminderAt(now, 'friday', '18:30')).toEqual(
      new Date('2026-06-12T18:30:00'),
    );
  });
});

describe('ReminderService', () => {
  it('schedules and sends a daily reminder when no entry was recorded today', async () => {
    const now = new Date('2026-06-03T12:00:00');
    const sendNotification = vi.fn<() => Promise<void>>(() => Promise.resolve());
    const scheduledTimers: Array<{ callback: () => void; delay: number }> = [];
    const service = new ReminderService({
      settingsRepository: {
        getSettings: () =>
          Promise.resolve({
            ...DEFAULT_APP_SETTINGS,
            dailyReminderEnabled: true,
            dailyReminderTime: '12:01',
            dailyReminderMessage: '可以花一分钟沉淀一下今天的工作。',
          }),
      },
      entryRepository: {
        listByDate: () => Promise.resolve([]),
      },
      sendNotification,
      setTimeout: (callback, delay) => {
        scheduledTimers.push({ callback, delay });

        return scheduledTimers.length;
      },
      clearTimeout: vi.fn(),
      now: () => now,
    });

    await service.reschedule();

    expect(scheduledTimers[0]).toMatchObject({ delay: 60_000 });

    scheduledTimers[0].callback();

    await vi.waitFor(() => {
      expect(sendNotification).toHaveBeenCalledWith('可以花一分钟沉淀一下今天的工作。');
    });
  });

  it('skips the daily reminder when an entry was already recorded today', async () => {
    const now = new Date('2026-06-03T12:00:00');
    const sendNotification = vi.fn<() => Promise<void>>(() => Promise.resolve());
    const scheduledTimers: Array<{ callback: () => void; delay: number }> = [];
    const service = new ReminderService({
      settingsRepository: {
        getSettings: () =>
          Promise.resolve({
            ...DEFAULT_APP_SETTINGS,
            dailyReminderEnabled: true,
            dailyReminderTime: '12:01',
          }),
      },
      entryRepository: {
        listByDate: () =>
          Promise.resolve([
            {
              id: 'entry_1',
              content: '今天记了一条',
              occurredAt: now.toISOString(),
              occurredOn: '2026-06-03',
              threadId: null,
              difficulty: null,
              effort: null,
              createdAt: now.toISOString(),
              updatedAt: now.toISOString(),
            },
          ]),
      },
      sendNotification,
      setTimeout: (callback, delay) => {
        scheduledTimers.push({ callback, delay });

        return scheduledTimers.length;
      },
      clearTimeout: vi.fn(),
      now: () => now,
    });

    await service.reschedule();
    scheduledTimers[0].callback();

    await vi.waitFor(() => {
      expect(scheduledTimers).toHaveLength(2);
    });
    expect(sendNotification).not.toHaveBeenCalled();
  });
});
