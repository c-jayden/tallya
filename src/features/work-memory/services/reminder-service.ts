import type { AppSettings } from './app-settings-repository';
import { appSettingsRepository } from './app-settings-repository';
import { entryRepository, getEntryDate } from './entry-repository';
import { logger } from './logger/logger';

type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

type TimeoutId = number;

type ReminderDependencies = {
  settingsRepository: Pick<typeof appSettingsRepository, 'getSettings'>;
  entryRepository: Pick<typeof entryRepository, 'listByDate'>;
  sendNotification: (body: string) => Promise<void>;
  setTimeout: (callback: () => void, delay: number) => TimeoutId;
  clearTimeout: (timeoutId: TimeoutId) => void;
  now: () => Date;
};

const weekdayIndexes: Record<Weekday, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export function getNextDailyReminderAt(now: Date, time: string) {
  const { hour, minute } = parseReminderTime(time);
  const next = new Date(now);

  next.setHours(hour, minute, 0, 0);

  // Missed reminders are not backfilled on startup; schedule the next future slot.
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

export function getNextWeeklyReminderAt(now: Date, weekday: string, time: string) {
  const { hour, minute } = parseReminderTime(time);
  const targetWeekday = getWeekdayIndex(weekday);
  const next = new Date(now);
  const daysUntilTarget = (targetWeekday - next.getDay() + 7) % 7;

  next.setDate(next.getDate() + daysUntilTarget);
  next.setHours(hour, minute, 0, 0);

  // If this week's slot already passed, wait for the next same weekday.
  if (next <= now) {
    next.setDate(next.getDate() + 7);
  }

  return next;
}

export class ReminderService {
  private dailyTimeout: TimeoutId | null = null;
  private weeklyTimeout: TimeoutId | null = null;
  private initialized = false;

  constructor(
    private readonly dependencies: ReminderDependencies = {
      settingsRepository: appSettingsRepository,
      entryRepository,
      sendNotification: sendTauriNotification,
      setTimeout: (callback, delay) => window.setTimeout(callback, delay),
      clearTimeout: (timeoutId) => window.clearTimeout(timeoutId),
      now: () => new Date(),
    },
  ) {}

  async init() {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    await this.reschedule();
  }

  async reschedule(settings?: AppSettings) {
    const nextSettings = settings ?? (await this.dependencies.settingsRepository.getSettings());
    const now = this.dependencies.now();

    this.clearTimers();

    if (nextSettings.dailyReminderEnabled) {
      const nextDailyReminderAt = getNextDailyReminderAt(now, nextSettings.dailyReminderTime);

      this.dailyTimeout = this.scheduleAt(
        nextDailyReminderAt,
        () => {
          void this.handleDailyReminder();
        },
      );
    }

    if (nextSettings.weeklyReminderEnabled) {
      const nextWeeklyReminderAt = getNextWeeklyReminderAt(
        now,
        nextSettings.weeklyReminderWeekday,
        nextSettings.weeklyReminderTime,
      );

      this.weeklyTimeout = this.scheduleAt(
        nextWeeklyReminderAt,
        () => {
          void this.handleWeeklyReminder();
        },
      );
    }
  }

  async sendTestNotification() {
    await this.sendSystemNotification('这是一条测试提醒。');
  }

  dispose() {
    this.clearTimers();
    this.initialized = false;
  }

  private scheduleAt(date: Date, callback: () => void) {
    const delay = Math.max(0, date.getTime() - this.dependencies.now().getTime());

    return this.dependencies.setTimeout(callback, delay);
  }

  private clearTimers() {
    if (this.dailyTimeout !== null) {
      this.dependencies.clearTimeout(this.dailyTimeout);
      this.dailyTimeout = null;
    }

    if (this.weeklyTimeout !== null) {
      this.dependencies.clearTimeout(this.weeklyTimeout);
      this.weeklyTimeout = null;
    }
  }

  private async handleDailyReminder() {
    try {
      const now = this.dependencies.now();
      const todayEntries = await this.dependencies.entryRepository.listByDate(getEntryDate(now));

      // In the entry model "recorded today" means at least one entry exists;
      // only remind when the day is still empty.
      if (todayEntries.length === 0) {
        const settings = await this.dependencies.settingsRepository.getSettings();
        await this.sendSystemNotification(settings.dailyReminderMessage);
      }
    } catch (error) {
      logger.warn('notification', 'reminder.daily_send_failed', 'Failed to send daily reminder', {
        reminderType: 'daily',
        error,
      });
    } finally {
      await this.reschedule();
    }
  }

  private async handleWeeklyReminder() {
    try {
      const settings = await this.dependencies.settingsRepository.getSettings();

      await this.sendSystemNotification(settings.weeklyReminderMessage);
    } catch (error) {
      logger.warn('notification', 'reminder.weekly_send_failed', 'Failed to send weekly reminder', {
        reminderType: 'weekly',
        error,
      });
    } finally {
      await this.reschedule();
    }
  }

  private async sendSystemNotification(body: string) {
    await this.dependencies.sendNotification(body);
  }
}

export const reminderService = new ReminderService();

async function sendTauriNotification(body: string) {
  const { invoke } = await import('@tauri-apps/api/core');

  await invoke('send_tallya_notification', { body });
}

function parseReminderTime(time: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  const hour = match ? Number(match[1]) : 0;
  const minute = match ? Number(match[2]) : 0;

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return { hour: 0, minute: 0 };
  }

  return { hour, minute };
}

function getWeekdayIndex(weekday: string) {
  return weekday in weekdayIndexes ? weekdayIndexes[weekday as Weekday] : weekdayIndexes.friday;
}
