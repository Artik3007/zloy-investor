/** Сравнение двух раундов: «было → стало». Чистые функции. */

import { getRank } from './rank';
import type { RankInfo } from './rank';
import type { CriterionResult } from './schemas';
import type { StoredRound } from './round-store';

export type Direction = 'up' | 'down' | 'same';

export type CriterionDelta = {
  id: number;
  name: string;
  before: number;
  after: number;
  delta: number;
  direction: Direction;
};

export type Comparison = {
  totalDelta: number;
  rankBefore: RankInfo;
  rankAfter: RankInfo;
  rankChange: Direction;
  criteria: CriterionDelta[];
  topGrowth: CriterionDelta[];
  pitchUnchanged: boolean;
};

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

function directionOf(delta: number): Direction {
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'same';
}

/** Подпись к направлению: exhaustive switch с проверкой never. */
export function directionLabel(direction: Direction): string {
  switch (direction) {
    case 'up':
      return 'выросло';
    case 'down':
      return 'упало';
    case 'same':
      return 'без изменений';
    default: {
      const never: never = direction;
      return never;
    }
  }
}

export function compareRounds(
  previous: StoredRound,
  current: { total: number; criteria: CriterionResult[]; pitch: string },
): Comparison {
  const before = new Map(previous.criteria.map((c) => [c.id, c]));

  const criteria: CriterionDelta[] = [];
  for (const now of current.criteria) {
    const was = before.get(now.id);
    // Критерия нет в одном из раундов — пропускаем, не падаем.
    if (!was) continue;
    const delta = now.score - was.score;
    criteria.push({
      id: now.id,
      name: now.name,
      before: was.score,
      after: now.score,
      delta,
      direction: directionOf(delta),
    });
  }

  const totalDelta = current.total - previous.total;
  const rankBefore = getRank(previous.total);
  const rankAfter = getRank(current.total);

  const rankChange = directionOf(
    (rankAfter.min ?? 0) - (rankBefore.min ?? 0),
  );

  const topGrowth = [...criteria]
    .filter((c) => c.delta > 0)
    .sort((a, b) => b.delta - a.delta || a.id - b.id)
    .slice(0, 3);

  return {
    totalDelta,
    rankBefore,
    rankAfter,
    rankChange,
    criteria,
    topGrowth,
    pitchUnchanged: normalize(previous.pitch) === normalize(current.pitch),
  };
}
