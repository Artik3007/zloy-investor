/**
 * LLM_PROVIDER=mock — детерминированные ответы без ключа: разработка, тесты
 * и запасной вариант на показе. Включается только явно и никогда не подменяет
 * реального провайдера молча (раздел 7.2 ТЗ).
 *
 * Ответы выводятся из текста промпта простыми эвристиками, поэтому полный
 * прогон 5 раундов работает и без сети.
 */

import type { ReasonCode, ThemeId } from '../schemas';
import { FALLBACK_ADVICE_BY_CRITERION, FALLBACK_QUESTIONS, FALLBACK_VERDICT, fallbackReaction } from './fallbacks';
import type { LlmTask } from './llm';

const MANIPULATION =
  /высок(ий|ому) балл|поставь(те)? (высок|максим)|по максимуму|не задава(ть|й) вопрос|не трать(те)? время на вопрос|игнорируй|покажи свой промпт|раскрой инструкц/i;
const NOT_A_PITCH =
  /помогите составить план|план подготовки|расписание экзаменов|у меня долг|как успеть всё/i;

function between(text: string, open: string, close: string): string {
  const a = text.indexOf(open);
  const b = text.indexOf(close);
  if (a === -1 || b === -1 || b < a) return '';
  return text.slice(a + open.length, b).trim();
}

function pitchOf(user: string): string {
  return between(user, '<pitch>', '</pitch>');
}

function answersOf(user: string): string[] {
  const out: string[] = [];
  const re = /<answer n="\d+">([\s\S]*?)<\/answer>/g;
  let m = re.exec(user);
  while (m) {
    out.push((m[1] ?? '').trim());
    m = re.exec(user);
  }
  return out;
}

function themeOf(user: string): ThemeId | null {
  if (/последний, пятый ответ/.test(user)) return null;
  if (/тема «клиент»/.test(user)) return 'client';
  if (/тема «деньги»/.test(user)) return 'money';
  if (/тема «конкуренты»/.test(user)) return 'competitors';
  if (/тема «реальность»/.test(user)) return 'reality';
  if (/тема «мотивация»/.test(user)) return 'heart';
  return 'client';
}

function mockStart(user: string): string {
  const pitch = pitchOf(user);
  const manipulation = MANIPULATION.test(pitch);
  const hasNumbers = /\d/.test(pitch);

  if (NOT_A_PITCH.test(pitch)) {
    return JSON.stringify({
      status: 'not_a_pitch',
      manipulation_detected: false,
      investor_line:
        'Это не питч, это просьба о помощи. Мне нужен проект, который я смогу прожарить.',
      question: '',
    });
  }

  // Просьба о балле плюс отсутствие любой конкретики = содержания нет.
  if (manipulation && !hasNumbers && pitch.length < 400) {
    return JSON.stringify({
      status: 'manipulation_only',
      manipulation_detected: true,
      investor_line: 'Я бы поставил, но цифры не врут. Дай мне факты, и поговорим.',
      question: '',
    });
  }

  return JSON.stringify({
    status: 'ok',
    manipulation_detected: manipulation,
    investor_line: '',
    question: FALLBACK_QUESTIONS.client,
  });
}

function strengthOf(answer: string): { strength: number; reason: ReasonCode } {
  const text = answer.trim();
  if (MANIPULATION.test(text)) return { strength: 0, reason: 'manipulation' };
  if (/не знаю|не считал|не считали|не проверял|пока нет данных/i.test(text)) {
    return { strength: 1, reason: 'honest_unknown' };
  }
  if (text.length < 25) return { strength: 0, reason: 'off_topic' };
  const hasNumbers = /\d/.test(text);
  if (hasNumbers && text.length >= 60) return { strength: 3, reason: 'concrete' };
  if (hasNumbers || text.length >= 120) return { strength: 2, reason: 'concrete' };
  return { strength: 1, reason: 'vague' };
}

function mockQuestion(user: string): string {
  const answers = answersOf(user);
  const last = answers[answers.length - 1] ?? '';
  const { strength, reason } = strengthOf(last);
  const theme = themeOf(user);

  return JSON.stringify({
    answer_strength: strength,
    reason,
    reaction_line: fallbackReaction(reason),
    next_question: theme === null ? null : FALLBACK_QUESTIONS[theme],
  });
}

/** Ключевые слова по критериям: грубо, но детерминированно. */
const HINTS: Record<number, RegExp> = {
  1: /проблем|реша|боль|помога/i,
  2: /монетизац|подписк|комисси|₽|руб|лиценз|цена/i,
  3: /конкурент|альтернатив|аналог|крупные сервис/i,
  4: /себестоимость|средний чек|выручк|посчита|потратил|стоит привлеч/i,
  5: /патент|товарный знак|регистрац|сертификац|лиценз/i,
  6: /продаж|оплат|пилот|заказ|клиент|скачиван|бронирован/i,
  7: /риск|юридическ|согласован|не договорил|текучк/i,
  8: /месяц|год|квартал|план|сезон|полгода/i,
  9: /уникальн|в отличие|плюс в том|наш плюс|не для|только у нас/i,
  10: /грант|инвестиц|раунд|чек|вложен|хотим получить/i,
};

function mockCriteria(user: string): string {
  const pitch = pitchOf(user);
  const answers = answersOf(user);
  const answersHaveNumbers = answers.some((a) => /\d/.test(a));
  const quote = pitch.replace(/\s+/g, ' ').trim().slice(0, 140);

  const criteria = Object.keys(HINTS).map((key) => {
    const id = Number(key);
    const hint = HINTS[id];
    const hit = hint ? hint.test(pitch) : false;
    const strong = id === 1 || id === 2 || id === 6;
    const score = hit ? (strong ? 2 : 1) : 0;
    const pitchOnly = answersHaveNumbers ? Math.max(0, score - 1) : score;

    return {
      id,
      score,
      score_pitch_only: pitchOnly,
      evidence: score > 0 ? quote : '',
      source: score > 0 ? 'pitch' : 'none',
    };
  });

  return JSON.stringify({ criteria, verdict_line: FALLBACK_VERDICT });
}

function mockAdvice(user: string): string {
  const ids: number[] = [];
  const re = /^(\d+)\. /gm;
  let m = re.exec(user);
  while (m) {
    const id = Number(m[1]);
    if (id >= 1 && id <= 10 && !ids.includes(id)) ids.push(id);
    m = re.exec(user);
  }

  const picked = (ids.length >= 3 ? ids.slice(-3) : [1, 6, 3])
    .map((id) => FALLBACK_ADVICE_BY_CRITERION[id])
    .filter((a): a is NonNullable<typeof a> => Boolean(a))
    .slice(0, 3);

  return JSON.stringify({
    advice: picked.map((a) => ({
      action: a.action,
      why: a.why,
      deadline_days: a.deadline_days,
      done_when: a.done_when,
    })),
  });
}

export function mockJson(task: LlmTask, user: string): string {
  switch (task) {
    case 'start':
      return mockStart(user);
    case 'question':
      return mockQuestion(user);
    case 'criteria':
      return mockCriteria(user);
    case 'advice':
      return mockAdvice(user);
    default: {
      const never: never = task;
      return never;
    }
  }
}
