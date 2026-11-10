const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayISO(now: Date = new Date()): string {
  return toISODate(now);
}

export function parseISODate(value: string): Date | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function isValidISODate(value: string): boolean {
  return parseISODate(value) !== null;
}

export function addDaysISO(value: string, days: number): string {
  const date = parseISODate(value);
  if (!date) return value;
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function compareISODate(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

const monthDayFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: 'numeric',
  day: 'numeric',
});

const monthDayWeekdayFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
});

const weekdayFormatter = new Intl.DateTimeFormat('zh-CN', { weekday: 'short' });

function formatMonthDay(date: Date, today: string): string {
  const sameYear = date.getFullYear() === Number(today.slice(0, 4));
  const monthDay = monthDayFormatter.format(date);
  return sameYear ? monthDay : `${date.getFullYear()}年${monthDay}`;
}

export function formatDueDate(value: string, today: string): string {
  if (value === today) return '今天';
  if (value === addDaysISO(today, 1)) return '明天';
  if (value === addDaysISO(today, -1)) return '昨天';
  const date = parseISODate(value);
  if (!date) return value;
  return formatMonthDay(date, today);
}

export function formatGroupDate(value: string, today: string): string {
  const date = parseISODate(value);
  if (!date) return value;
  const weekday = weekdayFormatter.format(date);
  const prefix = value === today ? '今天' : value === addDaysISO(today, 1) ? '明天' : '';
  const monthDay = formatMonthDay(date, today);
  return prefix ? `${prefix} · ${monthDay} ${weekday}` : `${monthDay} ${weekday}`;
}

export function formatDateWithWeekday(value: string): string {
  const date = parseISODate(value);
  if (!date) return value;
  return monthDayWeekdayFormatter.format(date);
}

export function msUntilNextMidnight(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1, 0);
  return Math.max(1000, next.getTime() - now.getTime());
}
