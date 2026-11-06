/**
 * Фазы боя как чистый reducer. Ни React, ни DOM, ни сети: страница только
 * присылает события и рисует состояние. Это позволяет тестировать бой целиком.
 *
 * Состояние «стойки» и «респекта» — ТОЛЬКО отображение. На оценку они не влияют:
 * балл считает сервер по тексту ответов.
 */

import type { Punch, QuestionPayload, ReasonCode } from '../schemas';
import type { Phase } from './timeline';

export const START_STANCE = 100;
export const STANCE_PER_HIT = 15;
export const MIN_STANCE = 25;
export const MAX_RESPECT = 5;
export const TOTAL_ROUNDS = 5;

export type Reaction = { punch: Punch; line: string; reason: ReasonCode };

export type FightState = {
  phase: Phase;
  round: number;
  stance: number;
  respect: number;
  parries: number;
  question: QuestionPayload | null;
  reaction: Reaction | null;
  answers: string[];
  /** Ждём ответ сервера: ввод заблокирован. */
  waiting: boolean;
  /** Текст ошибки сети или LLM. Транскрипт при этом не теряется. */
  error: string | null;
};

export type FightAction =
  | { type: 'FIGHT_START'; first: QuestionPayload }
  | { type: 'PHASE_DONE' }
  | { type: 'ANSWER_SUBMITTED'; answer: string }
  | { type: 'JUDGED'; reaction: Reaction; next: QuestionPayload | null }
  | { type: 'REQUEST_FAILED'; message: string }
  | { type: 'RETRY' }
  | { type: 'RESET' };

export const initialFight: FightState = {
  phase: 'intro',
  round: 1,
  stance: START_STANCE,
  respect: 0,
  parries: 0,
  question: null,
  reaction: null,
  answers: [],
  waiting: false,
  error: null,
};

/** Нокаута нет: бой всегда доходит до пятого раунда. */
function applyPunch(state: FightState, punch: Punch): FightState {
  if (punch === 'parry') {
    return {
      ...state,
      respect: Math.min(MAX_RESPECT, state.respect + 1),
      parries: state.parries + 1,
    };
  }
  return {
    ...state,
    stance: Math.max(MIN_STANCE, state.stance - STANCE_PER_HIT),
  };
}

/** Что идёт после фазы с фиксированной длительностью. */
function nextPhase(state: FightState): FightState {
  switch (state.phase) {
    case 'intro':
      return { ...state, phase: 'roundCard' };
    case 'roundCard':
      return { ...state, phase: 'idle' };
    case 'idle':
      return { ...state, phase: 'windup' };
    case 'windup':
      return { ...state, phase: 'strike' };
    case 'strike':
      return { ...state, phase: 'freeze' };
    case 'freeze':
      return { ...state, phase: 'answering' };
    case 'parry':
    case 'hit':
      // Пятый раунд уводит в угол секундантов, остальные — в следующий раунд.
      return state.round >= TOTAL_ROUNDS
        ? { ...state, phase: 'corner' }
        : { ...state, phase: 'between' };
    case 'between':
      return {
        ...state,
        phase: 'roundCard',
        round: state.round + 1,
        reaction: null,
      };
    case 'corner':
      return { ...state, phase: 'result' };
    // Эти фазы ждут игрока или сеть, таймером не двигаются.
    case 'answering':
    case 'judging':
    case 'result':
      return state;
    default: {
      const never: never = state.phase;
      return never;
    }
  }
}

export function fightReducer(state: FightState, action: FightAction): FightState {
  switch (action.type) {
    case 'FIGHT_START':
      return {
        ...initialFight,
        phase: 'intro',
        question: action.first,
      };

    case 'PHASE_DONE':
      return nextPhase(state);

    case 'ANSWER_SUBMITTED': {
      if (state.phase !== 'answering') return state;
      const answer = action.answer.trim();
      if (answer.length === 0) return state;
      return {
        ...state,
        phase: 'judging',
        answers: [...state.answers, answer],
        waiting: true,
        error: null,
      };
    }

    case 'JUDGED': {
      if (state.phase !== 'judging') return state;
      const scored = applyPunch(state, action.reaction.punch);
      return {
        ...scored,
        phase: action.reaction.punch,
        reaction: action.reaction,
        question: action.next,
        waiting: false,
        error: null,
      };
    }

    case 'REQUEST_FAILED':
      return { ...state, waiting: false, error: action.message };

    case 'RETRY': {
      // Ответ уже в транскрипте: убираем последний, чтобы отправить его заново.
      if (state.error === null) return state;
      return {
        ...state,
        phase: 'answering',
        answers: state.answers.slice(0, -1),
        waiting: false,
        error: null,
      };
    }

    case 'RESET':
      return initialFight;

    default: {
      const never: never = action;
      return never;
    }
  }
}

/** Ответ, который нужно отправить заново после ошибки. */
export function lastAnswer(state: FightState): string | null {
  return state.answers[state.answers.length - 1] ?? null;
}

export function isFightOver(state: FightState): boolean {
  return state.phase === 'result';
}

/** «Замедление времени»: стадия под фильтром, пока студент думает. */
export function isSlowMotion(phase: Phase): boolean {
  return phase === 'freeze' || phase === 'answering' || phase === 'judging';
}
