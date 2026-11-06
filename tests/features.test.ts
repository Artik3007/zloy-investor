import { describe, expect, it } from 'vitest';
import { buildIcs } from '../lib/ics';
import { compareRounds, directionLabel } from '../lib/compare';
import type { StoredRound } from '../lib/round-store';
import { CRITERIA } from '../lib/criteria';
import { axisAngle, labelAnchor, pointAt, valueOf } from '../lib/radar-geometry';
import type { Advice, CriterionResult } from '../lib/schemas';

const advice: Advice[] = [
  {
    action: 'Напиши 10 клиентам; спроси, как решают сейчас, и запиши ответы',
    why: 'Нужны факты, а не догадки',
    deadline_days: 2,
    done_when: 'Есть 10 ответов',
    done: false,
  },
  {
    action: 'Посчитай стоимость привлечения одного клиента',
    why: 'Без этого модель не проверить',
    deadline_days: 99,
    done_when: 'Есть расчёт',
    done: false,
  },
  {
    action: 'Выпиши 3 альтернативы, которыми пользуются сейчас',
    why: 'Конкуренты есть всегда',
    deadline_days: Number.NaN,
    done_when: 'Таблица готова',
    done: false,
  },
];

describe('ics', () => {
  const ics = buildIcs(advice, new Date('2026-11-06T10:00:00Z'));

  it('содержит три события и корректный каркас', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3);
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261108');
  });

  it('дедлайн вне 1..7 и NaN становится 1 днём', () => {
    expect(ics).toContain('DTSTART;VALUE=DATE:20261107');
  });

  it('экранирует точку с запятой и запятую', () => {
    const unfolded = ics.replace(/\r\n /g, '');
    expect(unfolded).toContain('Напиши 10 клиентам\\; спроси\\, как решают сейчас');
  });

  it('складывает длинные строки с продолжением через пробел', () => {
    for (const line of ics.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(ics).toContain('\r\n ');
  });

  it('строки заканчиваются CRLF', () => {
    expect(ics.split('\n').every((l, i, all) => i === all.length - 1 || l.endsWith('\r'))).toBe(true);
  });
});

function criteria(scores: number[]): CriterionResult[] {
  return CRITERIA.map((c, i) => ({
    id: c.id,
    name: c.name,
    score: scores[i] ?? 0,
    max: 3,
    evidence: '',
    source: 'none',
    delta_from_answers: 0,
  }));
}

function stored(total: number, scores: number[], pitch = 'питч первого раунда'): StoredRound {
  return {
    version: 1,
    round: 1,
    savedAt: '2026-11-01T00:00:00.000Z',
    pitch,
    total,
    criteria: criteria(scores).map((c) => ({ id: c.id, name: c.name, score: c.score, max: c.max })),
    advice: advice.map((a) => ({ ...a, deadline_days: 1 })),
  };
}

describe('сравнение раундов', () => {
  it('считает дельту, смену ранга и рост', () => {
    const prev = stored(30, [1, 1, 1, 1, 0, 0, 1, 1, 1, 1]);
    const cmp = compareRounds(prev, {
      total: 58,
      criteria: criteria([2, 2, 1, 1, 0, 2, 1, 1, 2, 2]),
      pitch: 'новый питч',
    });

    expect(cmp.totalDelta).toBe(28);
    expect(cmp.rankBefore.title).toBe('Пони');
    expect(cmp.rankAfter.title).toBe('Конь');
    expect(cmp.rankChange).toBe('up');
    expect(cmp.topGrowth.map((c) => c.id)).toEqual([6, 1, 2]);
    expect(cmp.pitchUnchanged).toBe(false);
  });

  it('падение балла даёт отрицательную дельту', () => {
    const cmp = compareRounds(stored(60, [2, 2, 2, 2, 2, 2, 2, 2, 2, 2]), {
      total: 40,
      criteria: criteria([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
      pitch: 'другой',
    });
    expect(cmp.totalDelta).toBe(-20);
    expect(cmp.rankChange).toBe('down');
    expect(cmp.topGrowth).toHaveLength(0);
  });

  it('ловит неизменившийся питч через нормализацию', () => {
    const cmp = compareRounds(stored(30, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1], 'Мой питч'), {
      total: 30,
      criteria: criteria([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
      pitch: '  мой   ПИТЧ  ',
    });
    expect(cmp.pitchUnchanged).toBe(true);
    expect(cmp.rankChange).toBe('same');
  });

  it('пропускает критерий, которого нет в прошлом раунде', () => {
    const prev = stored(30, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
    prev.criteria = prev.criteria.slice(0, 8);
    const cmp = compareRounds(prev, {
      total: 40,
      criteria: criteria([2, 2, 2, 2, 2, 2, 2, 2, 2, 2]),
      pitch: 'x',
    });
    expect(cmp.criteria).toHaveLength(8);
  });

  it('directionLabel закрывает все направления', () => {
    expect(directionLabel('up')).toBe('выросло');
    expect(directionLabel('down')).toBe('упало');
    expect(directionLabel('same')).toBe('без изменений');
  });
});

describe('геометрия радара', () => {
  it('первая ось сверху, дальше по часовой', () => {
    expect(axisAngle(0)).toBeCloseTo(-Math.PI / 2);
    const top = pointAt(0, 1);
    expect(top.x).toBeCloseTo(200);
    expect(top.y).toBeLessThan(200);
    expect(pointAt(2, 1).x).toBeGreaterThan(200);
  });

  it('нулевой балл рисуется в центре, без догадок', () => {
    expect(pointAt(3, 0)).toEqual({ x: 200, y: 200 });
  });

  it('значение зажимается в 0..1', () => {
    expect(valueOf(5, 3)).toBe(1);
    expect(valueOf(-1, 3)).toBe(0);
    expect(valueOf(Number.NaN, 3)).toBe(0);
    expect(valueOf(1, 0)).toBe(0);
  });

  it('подписи не выравниваются внутрь радара', () => {
    expect(labelAnchor(0)).toBe('middle');
    expect(labelAnchor(2)).toBe('start');
    expect(labelAnchor(7)).toBe('end');
  });
});
