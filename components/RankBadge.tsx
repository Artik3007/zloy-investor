'use client';

/** Ранг, общий балл и шкала прожарки. */

import { useEffect, useState } from 'react';
import { DONENESS_SCALE, donenessIndex, getRank } from '@/lib/rank';
import { useReducedMotion } from './ring/use-reduced-motion';

type Props = { total: number };

/** Счётчик балла от 0 до значения примерно за 800 мс. */
function useCountUp(target: number, enabled: boolean): number {
  const [value, setValue] = useState(enabled ? 0 : target);

  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const started = performance.now();
    const tick = () => {
      const p = Math.min(1, (performance.now() - started) / 800);
      setValue(Math.round(target * (1 - (1 - p) ** 3)));
      if (p < 1) raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [target, enabled]);

  return value;
}

export default function RankBadge({ total }: Props) {
  const reduced = useReducedMotion();
  const rank = getRank(total);
  const shown = useCountUp(rank.max === 0 ? 0 : Math.round(total), !reduced);
  const active = donenessIndex(rank.id);

  return (
    <section className="rank" style={{ ['--rank' as string]: rank.color }}>
      <div className="rank-top">
        <div className="rank-mark" aria-hidden="true">
          <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" className="rank-mark-bg" />
            <circle cx="50" cy="50" r="44" className="rank-mark-ring" />
            <text x="50" y="54" textAnchor="middle" dominantBaseline="middle">
              {rank.title.slice(0, 1)}
            </text>
          </svg>
        </div>

        <div className="rank-head">
          <p className="rank-score">
            <b>{reduced ? Math.round(total) : shown}</b>
            <span> / 100</span>
          </p>
          <h2 className="rank-title">{rank.title}</h2>
          <p className="rank-tagline">{rank.tagline}</p>
        </div>
      </div>

      <div className="doneness" aria-label={`Прожарка: ${rank.doneness}`}>
        {DONENESS_SCALE.map((step, i) => (
          <span key={step} className={i === active ? 'done-step done-step--on' : 'done-step'}>
            {step}
          </span>
        ))}
      </div>
    </section>
  );
}
