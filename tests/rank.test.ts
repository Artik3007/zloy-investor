import { describe, expect, it } from 'vitest';
import { clampTotal, donenessIndex, getRank, RANKS } from '../lib/rank';

describe('getRank', () => {
  it('держит границы диапазонов', () => {
    const cases: [number, string][] = [
      [0, 'Ослик'],
      [24, 'Ослик'],
      [25, 'Пони'],
      [44, 'Пони'],
      [45, 'Конь'],
      [64, 'Конь'],
      [65, 'Скакун'],
      [79, 'Скакун'],
      [80, 'Единорог'],
      [100, 'Единорог'],
    ];
    for (const [total, title] of cases) {
      expect(getRank(total).title, `total=${total}`).toBe(title);
    }
  });

  it('не падает на мусоре', () => {
    expect(getRank(Number.NaN).title).toBe('Ослик');
    expect(getRank(-5).title).toBe('Ослик');
    expect(getRank(250).title).toBe('Единорог');
    expect(getRank(Number.POSITIVE_INFINITY).title).toBe('Ослик');
  });

  it('clampTotal приводит к 0..100', () => {
    expect(clampTotal(Number.NaN)).toBe(0);
    expect(clampTotal(-1)).toBe(0);
    expect(clampTotal(101)).toBe(100);
    expect(clampTotal(63.6)).toBe(64);
  });

  it('диапазоны покрывают 0..100 без дыр', () => {
    for (let t = 0; t <= 100; t += 1) {
      const rank = getRank(t);
      expect(t >= rank.min && t <= rank.max).toBe(true);
    }
  });

  it('реплики рангов на «ты», без форм прошедшего времени по роду', () => {
    for (const rank of RANKS) {
      expect(rank.tagline).not.toMatch(/\bвы\b|\bвас\b|\bвам\b/i);
      expect(rank.tagline).not.toMatch(/(сказал|понял|сделал)а?\b/i);
    }
  });

  it('индекс прожарки уникален', () => {
    const idx = RANKS.map((r) => donenessIndex(r.id));
    expect(new Set(idx).size).toBe(5);
  });
});
