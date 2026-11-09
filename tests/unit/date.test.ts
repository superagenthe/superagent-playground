import { describe, expect, it } from 'vitest';
import {
  addDaysISO,
  compareISODate,
  formatDueDate,
  formatGroupDate,
  isValidISODate,
  msUntilNextMidnight,
  parseISODate,
  todayISO,
  toISODate,
} from '../../src/lib/date';

describe('date helpers', () => {
  it('formats local dates without UTC shifting', () => {
    expect(toISODate(new Date(2026, 0, 2))).toBe('2026-01-02');
    expect(todayISO(new Date(2026, 10, 9, 23, 59))).toBe('2026-11-09');
  });

  it('parses only real ISO dates', () => {
    expect(parseISODate('2026-02-28')?.getDate()).toBe(28);
    expect(parseISODate('2026-02-29')).toBeNull();
    expect(parseISODate('2026-13-01')).toBeNull();
    expect(isValidISODate('2026-11-09')).toBe(true);
    expect(isValidISODate('2026-1-9')).toBe(false);
  });

  it('adds days across month and year boundaries', () => {
    expect(addDaysISO('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysISO('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDaysISO('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('compares dates lexicographically', () => {
    expect(compareISODate('2026-01-01', '2026-01-02')).toBe(-1);
    expect(compareISODate('2026-01-02', '2026-01-02')).toBe(0);
    expect(compareISODate('2026-02-01', '2026-01-02')).toBe(1);
  });

  it('labels today, tomorrow and other dates', () => {
    expect(formatDueDate('2026-11-09', '2026-11-09')).toBe('今天');
    expect(formatDueDate('2026-11-10', '2026-11-09')).toBe('明天');
    expect(formatDueDate('2026-11-08', '2026-11-09')).toBe('昨天');
    expect(formatDueDate('2026-11-12', '2026-11-09')).toBe('11/12');
    expect(formatDueDate('2027-01-01', '2026-11-09')).toContain('2027');
  });

  it('groups next-7-day labels', () => {
    expect(formatGroupDate('2026-11-09', '2026-11-09')).toContain('今天');
    expect(formatGroupDate('2026-11-10', '2026-11-09')).toContain('明天');
    expect(formatGroupDate('2026-11-12', '2026-11-09')).toContain('11/12');
  });

  it('computes a positive delay until the next local midnight', () => {
    const now = new Date(2026, 10, 9, 23, 59, 30);
    const delay = msUntilNextMidnight(now);
    expect(delay).toBeGreaterThan(0);
    expect(delay).toBeLessThanOrEqual(31_000);
  });
});
