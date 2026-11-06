/**
 * 10 критериев «Стартап как диплом».
 * Здесь только то, что безопасно отдать в клиент: id, полное имя, короткая
 * подпись для радара. Веса лежат в lib/server/scoring.ts и в бандл не уезжают
 * (раздел 3 ТЗ).
 */

export type Criterion = {
  readonly id: number;
  readonly name: string;
  readonly short: string;
};

export const CRITERIA: readonly Criterion[] = [
  { id: 1, name: 'Реалистичность решения проблемы', short: 'Решение' },
  { id: 2, name: 'Бизнес-модель', short: 'Модель' },
  { id: 3, name: 'Анализ рынка и конкурентов', short: 'Рынок' },
  { id: 4, name: 'Финансовая модель', short: 'Финансы' },
  { id: 5, name: 'Интеллектуальная собственность или регистрация', short: 'ИС' },
  { id: 6, name: 'Первые продажи', short: 'Продажи' },
  { id: 7, name: 'Риски', short: 'Риски' },
  { id: 8, name: 'Горизонт расчёта', short: 'Горизонт' },
  { id: 9, name: 'Уникальность продукта', short: 'Уникальность' },
  { id: 10, name: 'Инвестиционная привлекательность', short: 'Инвест' },
] as const;

export const CRITERIA_COUNT = 10;
export const MAX_SCORE = 3;

export function criterionById(id: number): Criterion | undefined {
  return CRITERIA.find((c) => c.id === id);
}
