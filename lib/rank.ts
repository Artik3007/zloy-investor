/**
 * Ранги по total_100. Чистые функции, без React.
 * Ранг определяется только кодом: модель total не видит и ранг не выбирает.
 */

export type RankId = 'donkey' | 'pony' | 'horse' | 'racer' | 'unicorn';

export type RankInfo = {
  readonly id: RankId;
  readonly title: string;
  readonly doneness: string;
  readonly min: number;
  readonly max: number;
  readonly tagline: string;
  readonly color: string;
};

export const DONENESS_SCALE = [
  'Rare',
  'Medium Rare',
  'Medium',
  'Medium Well',
  'Well done',
] as const;

/** Реплики на «ты»: Игорь всегда говорит на «ты» (раздел 7.5 ТЗ). */
export const RANKS: readonly RankInfo[] = [
  {
    id: 'donkey',
    title: 'Ослик',
    doneness: 'Rare',
    min: 0,
    max: 24,
    tagline: 'Идея есть. Пока это всё, что у тебя есть.',
    color: '#8b7355',
  },
  {
    id: 'pony',
    title: 'Пони',
    doneness: 'Medium Rare',
    min: 25,
    max: 44,
    tagline: 'Бежишь, но пока не туда, куда нужно инвестору.',
    color: '#a8a29e',
  },
  {
    id: 'horse',
    title: 'Конь',
    doneness: 'Medium',
    min: 45,
    max: 64,
    tagline: 'Рабочая лошадка. До единорога не хватает цифр.',
    color: '#c084fc',
  },
  {
    id: 'racer',
    title: 'Скакун',
    doneness: 'Medium Well',
    min: 65,
    max: 79,
    tagline: 'Уже интересно. Закрой две дыры, и я выпишу чек.',
    color: '#38bdf8',
  },
  {
    id: 'unicorn',
    title: 'Единорог',
    doneness: 'Well done',
    min: 80,
    max: 100,
    tagline: 'Редкий случай. Иди защищайся, пока я не передумал.',
    color: '#ffd700',
  },
] as const;

/** NaN считаем нулём, выход за 0–100 прижимаем к диапазону. */
export function clampTotal(total: number): number {
  if (!Number.isFinite(total)) return 0;
  if (total < 0) return 0;
  if (total > 100) return 100;
  return Math.round(total);
}

export function getRank(total: number): RankInfo {
  const t = clampTotal(total);
  for (const rank of RANKS) {
    if (t >= rank.min && t <= rank.max) return rank;
  }
  // Диапазоны покрывают 0–100 целиком, но тип обязывает вернуть значение.
  return RANKS[0] as RankInfo;
}

/** Индекс сегмента шкалы прожарки (0..4) для подсветки. */
export function donenessIndex(id: RankId): number {
  switch (id) {
    case 'donkey':
      return 0;
    case 'pony':
      return 1;
    case 'horse':
      return 2;
    case 'racer':
      return 3;
    case 'unicorn':
      return 4;
    default: {
      const never: never = id;
      return never;
    }
  }
}
