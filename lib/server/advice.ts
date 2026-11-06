/**
 * Валидатор советов (раздел 7.4 ТЗ): ровно 3, каждый выполним за дни,
 * начинается с глагола в повелительном наклонении и содержит объект или число.
 */

import type { Advice, AdviceLlm } from '../schemas';
import { collapseWhitespace, hasBannedWords } from './sanitize';

/** Общие формулировки, которые советом не считаются. */
const BANNED_PHRASES = [
  /исследован[а-яё]*\s+рынк/i,
  /изуч[а-яё]*\s+(рынок|рынк|конкурент)/i,
  /улучш[а-яё]*\s+(презентаци|питч|подач|текст)/i,
  /продума[а-яё]*\s+(модель|стратеги)/i,
  /подума[а-яё]*\s+(над|о|про)\s/i,
  /проработа[а-яё]*\s+(модель|стратеги|рынок|вопрос)/i,
  /сделай\s+(анализ|исследован)/i,
  /разберись\s+с\s+(рынком|моделью)/i,
  /определи\s+(стратеги|позиционир)/i,
  /найди\s+инвестор/i,
  /поработа[а-яё]*\s+над/i,
];

/** Повелительное наклонение: «напиши», «посчитай», «собери», «проверь». */
const IMPERATIVE_TAIL = /(и|й|ь)$/i;

const EXTRA_IMPERATIVES = new Set(['дай', 'найди', 'задай', 'спроси', 'доведи']);

function startsWithImperative(action: string): boolean {
  const first = action.split(/\s+/)[0]?.toLowerCase().replace(/[^а-яёa-z]/gi, '');
  if (!first || first.length < 3) return false;
  if (EXTRA_IMPERATIVES.has(first)) return true;
  return IMPERATIVE_TAIL.test(first);
}

export function isValidAdvice(item: Advice): boolean {
  const action = collapseWhitespace(item.action);
  if (action.length < 12 || action.length > 200) return false;
  if (hasBannedWords(action)) return false;
  if (BANNED_PHRASES.some((re) => re.test(action))) return false;
  if (!startsWithImperative(action)) return false;

  // Объект или количество: либо число, либо развёрнутое действие.
  const hasNumber = /\d/.test(action);
  const words = action.split(/\s+/).length;
  if (!hasNumber && words < 4) return false;

  if (collapseWhitespace(item.done_when).length < 5) return false;
  if (!Number.isInteger(item.deadline_days)) return false;
  if (item.deadline_days < 1 || item.deadline_days > 7) return false;

  return true;
}

/** Дедлайн вне 1–7 и NaN заменяем на 1. */
function normalizeDeadline(raw: number | null): number {
  if (raw === null || !Number.isFinite(raw)) return 1;
  const n = Math.round(raw);
  if (n < 1 || n > 7) return 1;
  return n;
}

export function normalizeAdvice(llm: AdviceLlm): Advice[] {
  return llm.advice.map((a) => ({
    action: collapseWhitespace(a.action),
    why: collapseWhitespace(a.why),
    deadline_days: normalizeDeadline(a.deadline_days),
    done_when: collapseWhitespace(a.done_when),
    done: false,
  }));
}

export function allValid(list: readonly Advice[]): boolean {
  return list.length === 3 && list.every(isValidAdvice);
}
