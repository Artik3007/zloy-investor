/**
 * Экранирование пользовательского текста для промпта и проверка реплик модели.
 * Серверный модуль: в клиентский бандл не попадает.
 */

const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

/**
 * Питч и ответы идут в промпт внутри <pitch> и <answer>. Чтобы студент не мог
 * закрыть разделитель и дописать инструкции, гасим любую тег-подобную
 * конструкцию, оставляя обычные сравнения вида «a < b» читаемыми.
 */
export function escapeForPrompt(raw: string): string {
  return raw
    .replace(CONTROL_CHARS, ' ')
    .replace(/<(\/?)([a-zA-Z!?])/g, '‹$1$2')
    .trim();
}

export function collapseWhitespace(raw: string): string {
  return raw.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim();
}

/** Короткий список: мат и оскорбления личности. Бьём по проекту, не по человеку. */
const BANNED = [
  'хуй',
  'хуё',
  'пизд',
  'бляд',
  'блять',
  'ебат',
  'ебан',
  'ёбан',
  'ебуч',
  'сука',
  'мудак',
  'мудил',
  'говно',
  'дерьм',
  'нахуй',
  'похуй',
  'дебил',
  'идиот',
  'кретин',
  'тупиц',
  'тупой',
  'тупая',
  'ничтожес',
  'урод',
  'лох',
  'олух',
  'бездар',
];

export function hasBannedWords(text: string): boolean {
  const low = text.toLowerCase().replace(/ё/g, 'ё');
  return BANNED.some((w) => low.includes(w));
}

export type LineCheck = { ok: true; value: string } | { ok: false; why: string };

/** Общая проверка реплики: непустая, в пределах длины, без мата. */
export function checkLine(raw: string, maxLen: number): LineCheck {
  const value = collapseWhitespace(raw);
  if (value.length === 0) return { ok: false, why: 'empty' };
  if (value.length > maxLen) return { ok: false, why: 'too_long' };
  if (hasBannedWords(value)) return { ok: false, why: 'banned' };
  return { ok: true, value };
}

/** Вопрос дополнительно обязан быть вопросом и укладываться в 280 символов. */
export function checkQuestion(raw: string): LineCheck {
  const base = checkLine(raw, 280);
  if (!base.ok) return base;
  if (!base.value.endsWith('?')) return { ok: false, why: 'not_a_question' };
  return base;
}
