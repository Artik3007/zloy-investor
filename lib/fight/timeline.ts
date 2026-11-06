/**
 * Длительности фаз и таблица раундов (разделы 9.3 и 9.4 ТЗ).
 * Чистые данные: ни React, ни DOM.
 */

import type { ThemeId } from '../schemas';

export type Phase =
  | 'intro'
  | 'roundCard'
  | 'idle'
  | 'windup'
  | 'strike'
  | 'freeze'
  | 'answering'
  | 'judging'
  | 'parry'
  | 'hit'
  | 'between'
  | 'corner'
  | 'result';

export type IgorPose = 'idle' | 'windup' | 'jab' | 'hook' | 'uppercut' | 'impressed';
export type StudentPose = 'idle' | 'dodge' | 'hit';

/** Фазы с фиксированной длительностью. Остальные ждут игрока или сети. */
export const PHASE_MS: Partial<Record<Phase, number>> = {
  intro: 800,
  roundCard: 1200,
  idle: 800,
  windup: 700,
  strike: 220,
  freeze: 400,
  parry: 1200,
  hit: 1400,
  between: 1200,
  corner: 2600,
};

/** Минимальное время фазы судейства: держим драматургию, даже если сеть быстрая. */
export const JUDGING_MIN_MS = 900;

/** Таймер ответа: только визуальный, без штрафа. */
export const ANSWER_TIMER_S = 60;
export const ANSWER_TIMER_WARN_S = 10;

/** Печать реплики и автопереход после неё. */
export const TYPE_MS_PER_CHAR = 18;
export const REACTION_HOLD_MS = 2000;

export type RoundSpec = {
  readonly round: 1 | 2 | 3 | 4 | 5;
  readonly theme: ThemeId;
  readonly punchName: string;
  readonly pose: IgorPose;
  /** Кадр приближен (раунд 2) или свет гаснет до одного конуса (раунд 5). */
  readonly cameraZoom: number;
  readonly overlay: string;
  readonly vignette: number;
  readonly singleSpot: boolean;
};

export const ROUNDS: readonly RoundSpec[] = [
  {
    round: 1,
    theme: 'client',
    punchName: 'Джеб',
    pose: 'jab',
    cameraZoom: 1,
    overlay: 'rgba(255,160,60,.10)',
    vignette: 0.45,
    singleSpot: false,
  },
  {
    round: 2,
    theme: 'money',
    punchName: 'Бодишот',
    pose: 'jab',
    cameraZoom: 1.08,
    overlay: 'rgba(255,160,60,.06)',
    vignette: 0.5,
    singleSpot: false,
  },
  {
    round: 3,
    theme: 'competitors',
    punchName: 'Хук',
    pose: 'hook',
    cameraZoom: 1.02,
    overlay: 'rgba(0,0,0,0)',
    vignette: 0.6,
    singleSpot: false,
  },
  {
    round: 4,
    theme: 'reality',
    punchName: 'Апперкот',
    pose: 'uppercut',
    cameraZoom: 1.04,
    overlay: 'rgba(60,120,255,.10)',
    vignette: 0.65,
    singleSpot: false,
  },
  {
    round: 5,
    theme: 'heart',
    punchName: 'Гонг',
    pose: 'uppercut',
    cameraZoom: 1.06,
    overlay: 'rgba(60,120,255,.18)',
    vignette: 0.85,
    singleSpot: true,
  },
] as const;

export function roundSpec(round: number): RoundSpec {
  const spec = ROUNDS[round - 1];
  if (!spec) throw new Error(`round out of range: ${round}`);
  return spec;
}

/** Поза Игоря в текущей фазе. */
export function igorPose(phase: Phase, round: number): IgorPose {
  switch (phase) {
    case 'windup':
      return 'windup';
    case 'strike':
    case 'freeze':
    case 'answering':
    case 'judging':
      return roundSpec(round).pose;
    case 'parry':
      return 'impressed';
    case 'intro':
    case 'roundCard':
    case 'idle':
    case 'hit':
    case 'between':
    case 'corner':
    case 'result':
      return 'idle';
    default: {
      const never: never = phase;
      return never;
    }
  }
}

export function studentPose(phase: Phase): StudentPose {
  switch (phase) {
    case 'parry':
      return 'dodge';
    case 'hit':
      return 'hit';
    case 'intro':
    case 'roundCard':
    case 'idle':
    case 'windup':
    case 'strike':
    case 'freeze':
    case 'answering':
    case 'judging':
    case 'between':
    case 'corner':
    case 'result':
      return 'idle';
    default: {
      const never: never = phase;
      return never;
    }
  }
}
