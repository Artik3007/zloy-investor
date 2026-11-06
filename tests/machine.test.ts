import { describe, expect, it } from 'vitest';
import {
  fightReducer,
  initialFight,
  isSlowMotion,
  MIN_STANCE,
  START_STANCE,
  TOTAL_ROUNDS,
} from '../lib/fight/machine';
import type { FightAction, FightState, Reaction } from '../lib/fight/machine';
import { igorPose, PHASE_MS, ROUNDS, roundSpec, studentPose } from '../lib/fight/timeline';
import type { Phase } from '../lib/fight/timeline';
import { ROUND_THEMES } from '../lib/schemas';
import type { QuestionPayload } from '../lib/schemas';

const Q = (round: 1 | 2 | 3 | 4 | 5): QuestionPayload => ({
  round,
  theme: ROUND_THEMES[round - 1]!,
  text: `Вопрос раунда ${round}?`,
});

const parry: Reaction = { punch: 'parry', line: 'По делу.', reason: 'concrete' };
const hit: Reaction = { punch: 'hit', line: 'Пусто.', reason: 'vague' };

function run(state: FightState, actions: FightAction[]): FightState {
  return actions.reduce(fightReducer, state);
}

/** Прогоняет один раунд от карточки до исхода. */
function playRound(state: FightState, reaction: Reaction, next: QuestionPayload | null): FightState {
  const toAnswering: FightAction[] = Array.from({ length: 5 }, () => ({ type: 'PHASE_DONE' }));
  let s = run(state, toAnswering); // roundCard → idle → windup → strike → freeze → answering
  expect(s.phase).toBe('answering');
  s = fightReducer(s, { type: 'ANSWER_SUBMITTED', answer: 'ответ с цифрами 42' });
  expect(s.phase).toBe('judging');
  expect(s.waiting).toBe(true);
  s = fightReducer(s, { type: 'JUDGED', reaction, next });
  expect(s.phase).toBe(reaction.punch);
  return s;
}

describe('фазы раунда', () => {
  it('идут по порядку из раздела 9.3', () => {
    let s = fightReducer(initialFight, { type: 'FIGHT_START', first: Q(1) });
    const seen: Phase[] = [s.phase];
    for (let i = 0; i < 5; i += 1) {
      s = fightReducer(s, { type: 'PHASE_DONE' });
      seen.push(s.phase);
    }
    expect(seen).toEqual(['intro', 'roundCard', 'idle', 'windup', 'strike', 'freeze']);
    expect(fightReducer(s, { type: 'PHASE_DONE' }).phase).toBe('answering');
  });

  it('у фаз ожидания нет таймера', () => {
    expect(PHASE_MS.answering).toBeUndefined();
    expect(PHASE_MS.judging).toBeUndefined();
    expect(PHASE_MS.result).toBeUndefined();
  });

  it('answering, judging и freeze — это замедление времени', () => {
    expect(isSlowMotion('freeze')).toBe(true);
    expect(isSlowMotion('answering')).toBe(true);
    expect(isSlowMotion('judging')).toBe(true);
    expect(isSlowMotion('idle')).toBe(false);
  });
});

describe('полный бой', () => {
  it('ровно 5 раундов и выход в угол ринга', () => {
    let s = fightReducer(initialFight, { type: 'FIGHT_START', first: Q(1) });
    s = fightReducer(s, { type: 'PHASE_DONE' }); // intro → roundCard

    for (let round = 1; round <= TOTAL_ROUNDS; round += 1) {
      expect(s.round).toBe(round);
      const next = round < TOTAL_ROUNDS ? Q((round + 1) as 2 | 3 | 4 | 5) : null;
      s = playRound(s, round % 2 === 1 ? parry : hit, next);
      s = fightReducer(s, { type: 'PHASE_DONE' }); // исход → between | corner
      if (round < TOTAL_ROUNDS) {
        expect(s.phase).toBe('between');
        s = fightReducer(s, { type: 'PHASE_DONE' }); // between → roundCard
      }
    }

    expect(s.phase).toBe('corner');
    expect(s.answers).toHaveLength(5);
    expect(s.round).toBe(5);
    // 3 уворота (раунды 1, 3, 5) и 2 попадания
    expect(s.parries).toBe(3);
    expect(s.respect).toBe(3);
    expect(s.stance).toBe(START_STANCE - 2 * 15);
    expect(fightReducer(s, { type: 'PHASE_DONE' }).phase).toBe('result');
  });

  it('нокаута нет: стойка не падает ниже 25', () => {
    let s: FightState = { ...initialFight, phase: 'answering', question: Q(1) };
    for (let i = 0; i < 10; i += 1) {
      s = fightReducer(s, { type: 'ANSWER_SUBMITTED', answer: 'пусто' });
      s = fightReducer(s, { type: 'JUDGED', reaction: hit, next: Q(2) });
      s = { ...s, phase: 'answering' };
    }
    expect(s.stance).toBe(MIN_STANCE);
  });

  it('респект не превышает 5', () => {
    let s: FightState = { ...initialFight, phase: 'answering', question: Q(1) };
    for (let i = 0; i < 8; i += 1) {
      s = fightReducer(s, { type: 'ANSWER_SUBMITTED', answer: 'ответ с числом 7' });
      s = fightReducer(s, { type: 'JUDGED', reaction: parry, next: Q(2) });
      s = { ...s, phase: 'answering' };
    }
    expect(s.respect).toBe(5);
  });
});

describe('устойчивость', () => {
  it('пустой ответ не отправляется', () => {
    const s: FightState = { ...initialFight, phase: 'answering', question: Q(1) };
    expect(fightReducer(s, { type: 'ANSWER_SUBMITTED', answer: '   ' })).toBe(s);
  });

  it('ответ вне фазы ответа игнорируется', () => {
    const s: FightState = { ...initialFight, phase: 'windup' };
    expect(fightReducer(s, { type: 'ANSWER_SUBMITTED', answer: 'ответ' })).toBe(s);
  });

  it('ошибка сети не теряет транскрипт, повтор возвращает ввод', () => {
    let s: FightState = { ...initialFight, phase: 'answering', question: Q(1) };
    s = fightReducer(s, { type: 'ANSWER_SUBMITTED', answer: 'мой длинный ответ' });
    s = fightReducer(s, { type: 'REQUEST_FAILED', message: 'Судья отошёл' });
    expect(s.error).toBe('Судья отошёл');
    expect(s.waiting).toBe(false);
    expect(s.answers).toEqual(['мой длинный ответ']);

    s = fightReducer(s, { type: 'RETRY' });
    expect(s.phase).toBe('answering');
    expect(s.error).toBeNull();
    // ответ снят из транскрипта, чтобы уйти заново без дубля
    expect(s.answers).toEqual([]);
  });

  it('JUDGED вне судейства игнорируется', () => {
    const s: FightState = { ...initialFight, phase: 'answering' };
    expect(fightReducer(s, { type: 'JUDGED', reaction: parry, next: null })).toBe(s);
  });

  it('RESET возвращает начальное состояние', () => {
    const s: FightState = { ...initialFight, round: 4, stance: 55, answers: ['а'] };
    expect(fightReducer(s, { type: 'RESET' })).toEqual(initialFight);
  });
});

describe('таблица раундов', () => {
  it('темы и удары идут по порядку из раздела 6', () => {
    expect(ROUNDS.map((r) => r.theme)).toEqual([...ROUND_THEMES]);
    expect(ROUNDS.map((r) => r.punchName)).toEqual(['Джеб', 'Бодишот', 'Хук', 'Апперкот', 'Гонг']);
    expect(ROUNDS.map((r) => r.pose)).toEqual(['jab', 'jab', 'hook', 'uppercut', 'uppercut']);
  });

  it('свет пятого раунда — один конус', () => {
    expect(roundSpec(5).singleSpot).toBe(true);
    expect(roundSpec(1).singleSpot).toBe(false);
  });

  it('позы соответствуют фазам', () => {
    expect(igorPose('windup', 3)).toBe('windup');
    expect(igorPose('strike', 3)).toBe('hook');
    expect(igorPose('parry', 3)).toBe('impressed');
    expect(igorPose('idle', 3)).toBe('idle');
    expect(studentPose('parry')).toBe('dodge');
    expect(studentPose('hit')).toBe('hit');
    expect(studentPose('answering')).toBe('idle');
  });

  it('выход за диапазон раундов ловится', () => {
    expect(() => roundSpec(6)).toThrow();
    expect(() => roundSpec(0)).toThrow();
  });
});
