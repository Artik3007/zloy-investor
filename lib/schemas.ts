/**
 * Контракты запросов и ответов (раздел 7.1 ТЗ) + схемы вывода модели.
 * Сервер stateless: клиент присылает весь транскрипт, сервер его проверяет
 * и ничему не верит на слово.
 */

import { z } from 'zod';
import { CRITERIA_COUNT, MAX_SCORE } from './criteria';

export const MAX_PITCH = 8000;
export const MAX_ANSWER = 1200;
export const MAX_ROUNDS = 5;
export const MAX_BODY_BYTES = 64 * 1024;

export type ThemeId = 'client' | 'money' | 'competitors' | 'reality' | 'heart';
export type Punch = 'parry' | 'hit';
export type ReasonCode =
  | 'concrete'
  | 'vague'
  | 'off_topic'
  | 'evasive'
  | 'honest_unknown'
  | 'manipulation';
export type InputStatus = 'ok' | 'too_little' | 'not_a_pitch' | 'manipulation_only';

/** Темы раундов строго по порядку (раздел 6 ТЗ). */
export const ROUND_THEMES: readonly ThemeId[] = [
  'client',
  'money',
  'competitors',
  'reality',
  'heart',
] as const;

/** Название удара в раунде — для карточки раунда на сцене. */
export const PUNCH_NAMES: readonly string[] = [
  'Джеб',
  'Бодишот',
  'Хук',
  'Апперкот',
  'Гонг',
] as const;

export function themeForRound(round: number): ThemeId {
  const theme = ROUND_THEMES[round - 1];
  if (!theme) throw new Error(`round out of range: ${round}`);
  return theme;
}

// ---------- значения ----------

export const themeSchema = z.enum([
  'client',
  'money',
  'competitors',
  'reality',
  'heart',
]);
export const punchSchema = z.enum(['parry', 'hit']);
export const reasonSchema = z.enum([
  'concrete',
  'vague',
  'off_topic',
  'evasive',
  'honest_unknown',
  'manipulation',
]);

export const questionPayloadSchema = z.object({
  round: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
  theme: themeSchema,
  text: z.string().min(1).max(280),
});
export type QuestionPayload = z.infer<typeof questionPayloadSchema>;

// ---------- запросы ----------

const pitchField = z.string().min(1).max(MAX_PITCH);
const answersField = z
  .array(z.string().min(1).max(MAX_ANSWER))
  .min(1)
  .max(MAX_ROUNDS);

export const startReqSchema = z.object({ pitch: pitchField });
export type StartReq = z.infer<typeof startReqSchema>;

export const questionReqSchema = z.object({
  pitch: pitchField,
  answers: answersField,
});
export type QuestionReq = z.infer<typeof questionReqSchema>;

export const evaluateReqSchema = z.object({
  pitch: pitchField,
  answers: z.array(z.string().min(1).max(MAX_ANSWER)).length(MAX_ROUNDS),
});
export type EvaluateReq = z.infer<typeof evaluateReqSchema>;

// ---------- ответы ----------

export type StartRes =
  | { status: 'ok'; first: QuestionPayload }
  | {
      status: 'too_little' | 'not_a_pitch' | 'manipulation_only';
      investor_line: string;
    };

export type QuestionRes = {
  reaction: { punch: Punch; line: string; reason: ReasonCode };
  next: QuestionPayload | null;
};

export type CriterionResult = {
  id: number;
  name: string;
  score: number;
  max: number;
  evidence: string;
  source: string;
  delta_from_answers: number;
};

export type Advice = {
  action: string;
  why: string;
  deadline_days: number;
  done_when: string;
  done: boolean;
};

export type EvaluateRes = {
  criteria: CriterionResult[];
  total_100: number;
  verdict_line: string;
  advice: Advice[];
  flags: { manipulation_detected: boolean };
};

// ---------- вывод модели (валидируем перед использованием) ----------

export const startLlmSchema = z.object({
  status: z.enum(['ok', 'not_a_pitch', 'manipulation_only']),
  manipulation_detected: z.boolean(),
  investor_line: z.string().max(400).default(''),
  question: z.string().max(600).default(''),
});
export type StartLlm = z.infer<typeof startLlmSchema>;

export const questionLlmSchema = z.object({
  answer_strength: z.number().int().min(0).max(3),
  reason: reasonSchema,
  reaction_line: z.string().max(400),
  next_question: z.string().max(600).nullable(),
});
export type QuestionLlm = z.infer<typeof questionLlmSchema>;

export const criteriaLlmSchema = z.object({
  criteria: z
    .array(
      z.object({
        id: z.number().int().min(1).max(CRITERIA_COUNT),
        score: z.number().int().min(0).max(MAX_SCORE),
        score_pitch_only: z.number().int().min(0).max(MAX_SCORE),
        evidence: z.string().max(400).default(''),
        source: z.string().max(40).default('none'),
      }),
    )
    .length(CRITERIA_COUNT),
  verdict_line: z.string().max(400),
});
export type CriteriaLlm = z.infer<typeof criteriaLlmSchema>;

export const adviceLlmSchema = z.object({
  advice: z
    .array(
      z.object({
        action: z.string().min(1).max(300),
        why: z.string().max(300).default(''),
        deadline_days: z.number().nullable().default(1),
        done_when: z.string().max(300).default(''),
      }),
    )
    .length(3),
});
export type AdviceLlm = z.infer<typeof adviceLlmSchema>;
