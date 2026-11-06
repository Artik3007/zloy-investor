/**
 * Последний завершённый раунд в localStorage. На сервер ничего не уходит.
 * Любая ошибка storage гасится: приложение работает, реванш просто скрыт.
 */

import { z } from 'zod';
import type { Advice, CriterionResult } from './schemas';

export const ROUND_KEY = 'zi:last-round:v1';

const storedRoundSchema = z.object({
  version: z.literal(1),
  round: z.number().int().min(1).max(99),
  savedAt: z.string().min(1),
  pitch: z.string().min(1).max(8000),
  total: z.number().min(0).max(100),
  criteria: z
    .array(
      z.object({
        id: z.number().int().min(1).max(10),
        name: z.string(),
        score: z.number().int().min(0).max(3),
        max: z.number().int().min(1).max(3),
      }),
    )
    .length(10),
  advice: z
    .array(
      z.object({
        action: z.string(),
        why: z.string(),
        deadline_days: z.number().int(),
        done_when: z.string(),
        done: z.boolean(),
      }),
    )
    .length(3),
});

export type StoredRound = z.infer<typeof storedRoundSchema>;

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedValue: StoredRound | null = null;

function notify(): void {
  cachedRaw = null;
  for (const listener of listeners) listener();
}

export function subscribeRound(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** Снимок для useSyncExternalStore: ссылка стабильна, пока не менялся storage. */
export function roundSnapshot(): StoredRound | null {
  try {
    const raw = window.localStorage.getItem(ROUND_KEY);
    if (raw === cachedRaw) return cachedValue;
    cachedRaw = raw;
    cachedValue = raw ? (storedRoundSchema.safeParse(JSON.parse(raw) as unknown).data ?? null) : null;
    return cachedValue;
  } catch {
    return null;
  }
}

export function roundServerSnapshot(): StoredRound | null {
  return null;
}

export function loadRound(): StoredRound | null {
  try {
    const raw = window.localStorage.getItem(ROUND_KEY);
    if (!raw) return null;
    const parsed = storedRoundSchema.safeParse(JSON.parse(raw) as unknown);
    // Битые, чужие или устаревшие данные игнорируем как будто их нет.
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Сохраняем только то, что нужно для сравнения: без evidence и без ответов. */
export function saveRound(input: {
  round: number;
  pitch: string;
  total: number;
  criteria: CriterionResult[];
  advice: Advice[];
}): void {
  try {
    const data: StoredRound = {
      version: 1,
      round: input.round,
      savedAt: new Date().toISOString(),
      pitch: input.pitch.slice(0, 8000),
      total: input.total,
      criteria: input.criteria.map((c) => ({
        id: c.id,
        name: c.name,
        score: c.score,
        max: c.max,
      })),
      advice: input.advice.map((a) => ({
        action: a.action,
        why: a.why,
        deadline_days: a.deadline_days,
        done_when: a.done_when,
        done: a.done,
      })),
    };
    if (!storedRoundSchema.safeParse(data).success) return;
    window.localStorage.setItem(ROUND_KEY, JSON.stringify(data));
    notify();
  } catch {
    // Приватный режим или переполнение: реванш просто не сохранится.
  }
}

export function setAdviceDone(index: number, done: boolean): void {
  try {
    const current = loadRound();
    if (!current) return;
    const item = current.advice[index];
    if (!item) return;
    const advice = current.advice.map((a, i) => (i === index ? { ...a, done } : a));
    window.localStorage.setItem(ROUND_KEY, JSON.stringify({ ...current, advice }));
    notify();
  } catch {
    // Молча.
  }
}

export function clearRound(): void {
  try {
    window.localStorage.removeItem(ROUND_KEY);
    notify();
  } catch {
    // Молча.
  }
}
