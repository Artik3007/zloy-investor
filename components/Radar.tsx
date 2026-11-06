'use client';

/** Радар по 10 критериям. Чистый SVG, без библиотек. */

import type { CriterionResult } from '@/lib/schemas';
import {
  AXIS_COUNT,
  CENTER,
  LABEL_RADIUS,
  LEVELS,
  labelAnchor,
  labelPoint,
  polygon,
  ring,
  spoke,
  toPoints,
  valueOf,
} from '@/lib/radar-geometry';
import { CRITERIA } from '@/lib/criteria';
import { useReducedMotion } from './ring/use-reduced-motion';

type Props = {
  criteria: CriterionResult[];
  /** Предыдущий раунд: рисуется пунктиром поверх (фишка 5). */
  previous?: CriterionResult[];
  size?: number;
  total?: number;
};

function shortLabel(id: number, index: number): string {
  return CRITERIA.find((c) => c.id === id)?.short ?? CRITERIA[index]?.short ?? '';
}

function isUsable(list: readonly CriterionResult[] | undefined): boolean {
  return (
    Array.isArray(list) &&
    list.length === AXIS_COUNT &&
    list.every((c) => Number.isFinite(c.score) && Number.isFinite(c.max))
  );
}

export default function Radar({ criteria, previous, size, total }: Props) {
  const reduced = useReducedMotion();

  // Устойчивость: на кривых данных показываем список, а не падаем.
  if (!isUsable(criteria)) {
    console.warn('[Radar] ожидалось 10 валидных критериев, рисуем список');
    const safe: CriterionResult[] = Array.isArray(criteria) ? criteria : [];
    return (
      <ul className="radar-fallback">
        {safe.map((c) => (
          <li key={c.id}>
            {c.name}: {c.score} из {c.max}
          </li>
        ))}
      </ul>
    );
  }

  const values = criteria.map((c) => valueOf(c.score, c.max));
  const prevValues =
    previous && isUsable(previous)
      ? previous.map((c) => valueOf(c.score, c.max))
      : null;

  const label =
    total === undefined
      ? 'Радар оценки по десяти критериям'
      : `Радар оценки, общий балл ${total} из 100`;

  return (
    <div className="radar" style={size ? { maxWidth: size } : undefined}>
      {/* Поле шире геометрии: подписи осей не должны обрезаться по краям. */}
      <svg viewBox="-54 -18 508 436" role="img" aria-label={label}>
        <g className="radar-grid">
          {LEVELS.map((level) => (
            <polygon key={level} points={toPoints(ring(level))} />
          ))}
          {Array.from({ length: AXIS_COUNT }, (_, i) => {
            const [a, b] = spoke(i);
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
          })}
        </g>

        {prevValues ? (
          <polygon className="radar-prev" points={toPoints(polygon(prevValues))} />
        ) : null}

        <polygon
          className={reduced ? 'radar-now' : 'radar-now radar-now--grow'}
          points={toPoints(polygon(values))}
          style={{ transformOrigin: `${CENTER.x}px ${CENTER.y}px` }}
        />

        <g className="radar-dots">
          {polygon(values).map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={values[i] === 0 ? 0 : 3.5} />
          ))}
        </g>

        <g className="radar-labels">
          {criteria.map((c, i) => {
            const p = labelPoint(i, CENTER, LABEL_RADIUS);
            return (
              <text key={c.id} x={p.x} y={p.y} textAnchor={labelAnchor(i)} dominantBaseline="middle">
                {shortLabel(c.id, i)}
              </text>
            );
          })}
        </g>
      </svg>

      <ul className="sr-only">
        {criteria.map((c) => (
          <li key={c.id}>
            {c.name}: {c.score} из {c.max}
          </li>
        ))}
      </ul>
    </div>
  );
}
