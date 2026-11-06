'use client';

/** Карточка «РАУНД N» с названием удара. */

import { roundSpec } from '@/lib/fight/timeline';

type Props = { round: number };

export default function RoundBell({ round }: Props) {
  const spec = roundSpec(round);
  return (
    <div className="round-card" role="status">
      <span className="round-card-n">Раунд {round}</span>
      <span className="round-card-punch">{spec.punchName}</span>
    </div>
  );
}
