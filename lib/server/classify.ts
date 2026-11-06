/**
 * Предфильтр входа. Детерминированный шаг без LLM: он один решает too_little,
 * остальное (not_a_pitch / manipulation_only) определяет модель в том же
 * вызове, что генерирует первый вопрос.
 */

import { collapseWhitespace } from './sanitize';

export type PreFilter = { status: 'ok' } | { status: 'too_little' };

const MIN_CHARS = 200;

/** «см. презентацию», «прикрепила файлом» — отсылка к файлу вместо текста. */
const FILE_REFERENCE =
  /(см\.?\s*(презентац|файл|вложен)|в презентации|прикреп(ил|ила|лено|ляю)|файлом|во вложении|по ссылке в файле)/i;

const FILE_REF_CONTENT_LIMIT = 600;

export function preFilter(pitch: string): PreFilter {
  const collapsed = collapseWhitespace(pitch);

  if (collapsed.length < MIN_CHARS) return { status: 'too_little' };

  // Текст отсылает к файлу, а своего содержания почти нет.
  if (FILE_REFERENCE.test(collapsed) && collapsed.length < FILE_REF_CONTENT_LIMIT) {
    return { status: 'too_little' };
  }

  return { status: 'ok' };
}

/**
 * Детектор манипуляции в содержательном питче: просьба о балле не влияет
 * на оценку, но флаг показываем на итоге.
 */
const MANIPULATION_ASK =
  /(высок(ий|ому|ий)\s+балл|поставь(те)?\s+(высок|максим|10|отличн)|оцени(ть|те)?\s+(его\s+)?по\s+максимуму|по\s+максимуму|не\s+задава(ть|й)\s+вопрос|не\s+трать(те)?\s+время\s+на\s+вопрос|игнорируй\s+(правила|инструкц)|покажи\s+(свой\s+)?промпт|раскрой\s+(свои\s+)?инструкц|забудь\s+(все\s+)?(предыдущие\s+)?инструкц|ты\s+больше\s+не)/i;

export function detectManipulation(texts: readonly string[]): boolean {
  return texts.some((t) => MANIPULATION_ASK.test(collapseWhitespace(t)));
}
