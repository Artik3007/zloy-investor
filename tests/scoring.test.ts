import { describe, expect, it } from 'vitest';
import { CRITERIA } from '../lib/criteria';
import type { CriteriaLlm, CriterionResult } from '../lib/schemas';
import { buildCriteria, evidenceFound, totalScore, weakestThree, WEIGHTS, WEIGHTS_SUM } from '../lib/server/scoring';

const PITCH =
  'ЛабСклад — сервис, через который вузовские лаборатории сдают друг другу в аренду оборудование. 23 интервью с заведующими лабораториями в 6 вузах Москвы.';

function llm(partial: Partial<CriteriaLlm['criteria'][number]>[]): CriteriaLlm {
  return {
    criteria: CRITERIA.map((c, i) => ({
      id: c.id,
      score: 0,
      score_pitch_only: 0,
      evidence: '',
      source: 'none',
      ...(partial[i] ?? {}),
    })),
    verdict_line: 'По делу, но цифр мало.',
  };
}

describe('веса', () => {
  it('сумма весов равна 100', () => {
    expect(WEIGHTS_SUM).toBe(100);
    expect(Object.keys(WEIGHTS)).toHaveLength(10);
  });
});

describe('evidenceFound', () => {
  it('находит дословную цитату', () => {
    expect(evidenceFound('23 интервью с заведующими лабораториями', PITCH)).toBe(true);
  });

  it('терпит регистр и лишние пробелы', () => {
    expect(evidenceFound('  23   ИНТЕРВЬЮ с заведующими  ', PITCH)).toBe(true);
  });

  it('принимает совпадение не меньше 60% слов подряд', () => {
    expect(evidenceFound('23 интервью с заведующими лабораториями в 9 вузах Казани', PITCH)).toBe(true);
  });

  it('отвергает выдуманную цитату', () => {
    expect(evidenceFound('у нас 400 платящих клиентов и выручка 2 млн', PITCH)).toBe(false);
    expect(evidenceFound('', PITCH)).toBe(false);
  });
});

describe('buildCriteria', () => {
  it('обнуляет оценку с невыдуманной, но ненайденной цитатой', () => {
    const { criteria, warnings } = buildCriteria(
      llm([{ score: 3, score_pitch_only: 1, evidence: 'выручка 5 млн рублей в месяц', source: 'pitch' }]),
      PITCH,
      ['ответ'],
    );
    expect(criteria[0]?.score).toBe(0);
    expect(criteria[0]?.source).toBe('none');
    expect(warnings[0]).toEqual({ id: 1, why: 'not_found' });
  });

  it('оставляет оценку с подтверждённой цитатой и считает delta', () => {
    const { criteria, warnings } = buildCriteria(
      llm([{ score: 3, score_pitch_only: 1, evidence: '23 интервью с заведующими лабораториями', source: 'pitch' }]),
      PITCH,
      ['ответ'],
    );
    expect(criteria[0]?.score).toBe(3);
    expect(criteria[0]?.delta_from_answers).toBe(2);
    expect(warnings).toHaveLength(0);
  });

  it('отрицательную delta обнуляет', () => {
    const { criteria } = buildCriteria(
      llm([{ score: 1, score_pitch_only: 3, evidence: '23 интервью', source: 'pitch' }]),
      PITCH,
      ['ответ'],
    );
    expect(criteria[0]?.delta_from_answers).toBe(0);
  });

  it('отвергает выдуманный source', () => {
    const { criteria, warnings } = buildCriteria(
      llm([{ score: 2, score_pitch_only: 0, evidence: '23 интервью', source: 'answer_9' }]),
      PITCH,
      ['ответ'],
    );
    expect(criteria[0]?.score).toBe(0);
    expect(warnings[0]?.why).toBe('bad_source');
  });

  it('требует цитату при score > 0', () => {
    const { warnings } = buildCriteria(
      llm([{ score: 2, score_pitch_only: 0, evidence: '', source: 'pitch' }]),
      PITCH,
      ['ответ'],
    );
    expect(warnings[0]?.why).toBe('no_evidence');
  });

  it('всегда возвращает ровно 10 критериев с именами из кода', () => {
    const { criteria } = buildCriteria(llm([]), PITCH, []);
    expect(criteria).toHaveLength(10);
    expect(criteria.map((c) => c.name)).toEqual(CRITERIA.map((c) => c.name));
    expect(criteria.every((c) => c.max === 3)).toBe(true);
  });
});

function result(scores: number[]): CriterionResult[] {
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

describe('totalScore', () => {
  it('нули дают 0, максимум даёт 100', () => {
    expect(totalScore(result([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe(0);
    expect(totalScore(result([3, 3, 3, 3, 3, 3, 3, 3, 3, 3]))).toBe(100);
  });

  it('считает по весам', () => {
    // только критерий 6 (вес 16) на максимум
    expect(totalScore(result([0, 0, 0, 0, 0, 3, 0, 0, 0, 0]))).toBe(16);
    // все по 1 из 3 = треть от 100
    expect(totalScore(result([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]))).toBe(33);
  });

  it('не падает на мусоре в score', () => {
    const broken = result([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    broken[0] = { ...broken[0]!, score: Number.NaN };
    broken[1] = { ...broken[1]!, score: 99 };
    const total = totalScore(broken);
    expect(Number.isFinite(total)).toBe(true);
    expect(total).toBeGreaterThanOrEqual(0);
    expect(total).toBeLessThanOrEqual(100);
  });
});

describe('weakestThree', () => {
  it('берёт три самых дорогих провала', () => {
    // всё на 3, кроме 6 (вес 16), 10 (вес 14) и 1 (вес 12)
    const scores = [0, 3, 3, 3, 3, 0, 3, 3, 3, 0];
    const weakest = weakestThree(result(scores)).map((c) => c.id);
    expect(weakest).toEqual([6, 10, 1]);
  });

  it('всегда отдаёт ровно 3', () => {
    expect(weakestThree(result([3, 3, 3, 3, 3, 3, 3, 3, 3, 3]))).toHaveLength(3);
  });
});
