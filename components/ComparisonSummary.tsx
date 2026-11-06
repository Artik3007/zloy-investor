'use client';

/** «Было → стало» во втором раунде. */

import Radar from './Radar';
import type { Comparison } from '@/lib/compare';
import type { CriterionResult } from '@/lib/schemas';

type Props = {
  comparison: Comparison;
  criteria: CriterionResult[];
  previous: CriterionResult[];
  total: number;
};

function sign(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return String(n);
  return '=';
}

export default function ComparisonSummary({ comparison, criteria, previous, total }: Props) {
  const { totalDelta, rankBefore, rankAfter, rankChange, topGrowth, pitchUnchanged } = comparison;
  const tone = totalDelta > 0 ? 'up' : totalDelta < 0 ? 'down' : 'same';

  return (
    <section className="compare">
      <h2 className="compare-title">Было → стало</h2>

      <p className={`compare-delta compare-delta--${tone}`}>
        {totalDelta === 0 ? '0' : sign(totalDelta)}
      </p>
      <p className="compare-rank">
        {rankBefore.title} → <b>{rankAfter.title}</b>
        {rankChange === 'up' ? <span className="compare-up"> Ранг вырос!</span> : null}
      </p>

      {totalDelta <= 0 ? (
        <p className="compare-note">
          Цифры не сдвинулись. Проверь, что ты закрыл хотя бы один из трёх советов.
        </p>
      ) : null}

      {pitchUnchanged ? (
        <p className="compare-note">
          Питч тот же. Оценка может измениться только за счёт ответов.
        </p>
      ) : null}

      <Radar criteria={criteria} previous={previous} total={total} />

      {topGrowth.length > 0 ? (
        <div className="compare-top">
          <h3>Что выросло больше всего</h3>
          <ul>
            {topGrowth.map((c) => (
              <li key={c.id}>
                {c.name} <b>{sign(c.delta)}</b>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ul className="compare-list">
        {comparison.criteria.map((c) => (
          <li key={c.id} className={c.direction === 'up' ? 'compare-row compare-row--up' : 'compare-row'}>
            <span>{c.name}</span>
            <span className="compare-nums">
              {c.before} → {c.after} <b>{sign(c.delta)}</b>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
