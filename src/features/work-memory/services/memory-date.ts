export function getDailyMemoryDate(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

// Calendar-day difference between two YYYY-MM-DD dates, computed in UTC so it is
// not skewed by local DST or time-of-day. Positive when toDate is later.
export function differenceInCalendarDays(fromDate: string, toDate: string) {
  return Math.round((parseDateOnly(toDate) - parseDateOnly(fromDate)) / 86_400_000);
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.split('-').map(Number);

  return Date.UTC(year, month - 1, day);
}
