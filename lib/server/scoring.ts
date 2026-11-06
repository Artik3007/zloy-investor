/**
 * Веса, total_100 и проверка цитат. Только на сервере.
 * total и ранг считает ТОЛЬКО код: модель их не видит и не выбирает.
 */

import { CRITERIA, MAX_SCORE } from '../criteria';
import type { CriteriaLlm, CriterionResult } from '../schemas';

/** Веса архетипа «бизнес-ангел»: ценит первые продажи и инвестпривлекательность. */
export const WEIGHTS: Record<number, number> = {
  1: 12, // Реалистичность решения проблемы
  2: 12, // Бизнес-модель
  3: 12, // Анализ рынка и конкурентов
  4: 8, //  Финансовая модель
  5: 4, //  Интеллектуальная собственность
  6: 16, // Первые продажи
  7: 8, //  Риски
  8: 4, //  Горизонт расчёта
  9: 10, // Уникальность продукта
  10: 14, // Инвестиционная привлекательность
};

export const WEIGHTS_SUM = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);

const VALID_SOURCES = new Set([
  'pitch',
  'answer_1',
  'answer_2',
  'answer_3',
  'answer_4',
  'answer_5',
  'none',
]);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[«»"'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sourceText(
  source: string,
  pitch: string,
  answers: readonly string[],
): string | null {
  if (source === 'pitch') return pitch;
  const m = source.match(/^answer_([1-5])$/);
  if (!m) return null;
  const idx = Number(m[1]) - 1;
  return answers[idx] ?? null;
}

/**
 * Цитата считается подтверждённой, если она есть в указанном источнике
 * дословно либо не менее 60% её слов идут подряд (раздел 7.4 ТЗ).
 */
export function evidenceFound(evidence: string, source: string): boolean {
  const needle = normalize(evidence);
  const haystack = normalize(source);
  if (needle.length === 0 || haystack.length === 0) return false;
  if (haystack.includes(needle)) return true;

  const words = needle.split(' ').filter(Boolean);
  if (words.length === 0) return false;
  const need = Math.max(1, Math.ceil(words.length * 0.6));

  for (let len = words.length; len >= need; len -= 1) {
    for (let i = 0; i + len <= words.length; i += 1) {
      if (haystack.includes(words.slice(i, i + len).join(' '))) return true;
    }
  }
  return false;
}

export type EvidenceWarning = { id: number; why: 'bad_source' | 'no_evidence' | 'not_found' };

/**
 * Приводит оценку модели к контракту: проверяет цитаты, обнуляет
 * неподтверждённое, считает delta_from_answers. Имена критериев берутся из
 * кода, а не от модели.
 */
export function buildCriteria(
  llm: CriteriaLlm,
  pitch: string,
  answers: readonly string[],
): { criteria: CriterionResult[]; warnings: EvidenceWarning[] } {
  const byId = new Map(llm.criteria.map((c) => [c.id, c]));
  const warnings: EvidenceWarning[] = [];

  const criteria = CRITERIA.map<CriterionResult>((meta) => {
    const raw = byId.get(meta.id);
    const base: CriterionResult = {
      id: meta.id,
      name: meta.name,
      score: 0,
      max: MAX_SCORE,
      evidence: '',
      source: 'none',
      delta_from_answers: 0,
    };

    if (!raw || raw.score <= 0) return base;

    const evidence = raw.evidence.trim().slice(0, 160);
    const source = raw.source.trim();

    if (!VALID_SOURCES.has(source) || source === 'none') {
      warnings.push({ id: meta.id, why: 'bad_source' });
      return base;
    }
    if (evidence.length === 0) {
      warnings.push({ id: meta.id, why: 'no_evidence' });
      return base;
    }

    const text = sourceText(source, pitch, answers);
    if (text === null || !evidenceFound(evidence, text)) {
      warnings.push({ id: meta.id, why: 'not_found' });
      return base;
    }

    return {
      ...base,
      score: raw.score,
      evidence,
      source,
      delta_from_answers: Math.max(0, raw.score - raw.score_pitch_only),
    };
  });

  return { criteria, warnings };
}

/** total_100 = round( Σ вес_i × score_i / 3 ). */
export function totalScore(criteria: readonly CriterionResult[]): number {
  const sum = criteria.reduce((acc, c) => {
    const weight = WEIGHTS[c.id] ?? 0;
    const score = Number.isFinite(c.score) ? Math.min(Math.max(c.score, 0), MAX_SCORE) : 0;
    return acc + (weight * score) / MAX_SCORE;
  }, 0);
  return Math.round(Math.min(Math.max(sum, 0), 100));
}

/** Три самых слабых критерия по вес × (3 − score). Их закрывают советы. */
export function weakestThree(criteria: readonly CriterionResult[]): CriterionResult[] {
  return [...criteria]
    .sort((a, b) => {
      const gapA = (WEIGHTS[a.id] ?? 0) * (MAX_SCORE - a.score);
      const gapB = (WEIGHTS[b.id] ?? 0) * (MAX_SCORE - b.score);
      if (gapB !== gapA) return gapB - gapA;
      const weightDiff = (WEIGHTS[b.id] ?? 0) - (WEIGHTS[a.id] ?? 0);
      if (weightDiff !== 0) return weightDiff;
      return a.id - b.id;
    })
    .slice(0, 3);
}
