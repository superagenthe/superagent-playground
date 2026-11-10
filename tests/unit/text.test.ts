import { describe, expect, it } from 'vitest';
import {
  comparisonKey,
  graphemeLength,
  normalizeListName,
  normalizeTitle,
  stripLineBreaks,
} from '../../src/lib/text';

describe('text helpers', () => {
  it('counts user-visible graphemes', () => {
    expect(graphemeLength('')).toBe(0);
    expect(graphemeLength('你好')).toBe(2);
    expect(graphemeLength('👍🏽')).toBe(1);
    expect(graphemeLength('👨‍👩‍👧‍👦')).toBe(1);
    expect(graphemeLength('A👍🏽中')).toBe(3);
  });

  it('turns line breaks into spaces', () => {
    expect(stripLineBreaks('第一行\n第二行')).toBe('第一行 第二行');
    expect(stripLineBreaks('a\r\nb')).toBe('a b');
  });

  it('normalizes titles and list names by trimming only the ends', () => {
    expect(normalizeTitle('  买 牛奶  \n')).toBe('买 牛奶');
    expect(normalizeListName('  工作 计划  ')).toBe('工作 计划');
  });

  it('builds a case-insensitive comparison key without collapsing spaces', () => {
    expect(comparisonKey(' Work Plan ')).toBe('work plan');
    expect(comparisonKey('工作  计划')).not.toBe(comparisonKey('工作 计划'));
  });
});
