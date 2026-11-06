'use client';

/**
 * Сцена: слои, камера, свет. Рисуем через DOM и CSS-трансформации,
 * анимируем только transform и opacity (раздел 9.2 ТЗ).
 */

import { useEffect, useRef, useState } from 'react';
import Fighter from './Fighter';
import FistPov from './FistPov';
import type { Phase } from '@/lib/fight/timeline';
import { igorPose, roundSpec, studentPose } from '@/lib/fight/timeline';
import { isSlowMotion } from '@/lib/fight/machine';
import { useReducedMotion } from './use-reduced-motion';

type Props = {
  phase: Phase;
  round: number;
  children?: React.ReactNode;
};

const SPRITES = [
  '/ring/ring-bg.jpg',
  '/ring/corner-bg.jpg',
  '/ring/igor-idle.png',
  '/ring/igor-windup.png',
  '/ring/igor-jab.png',
  '/ring/igor-hook.png',
  '/ring/igor-uppercut.png',
  '/ring/igor-impressed.png',
  '/ring/student-idle.png',
  '/ring/student-dodge.png',
  '/ring/student-hit.png',
  '/ring/fist-pov.png',
];

/** Предзагрузка спрайтов, чтобы бой не мигал при смене позы. */
function usePreload() {
  useEffect(() => {
    for (const src of SPRITES) {
      const img = new Image();
      img.src = src;
    }
  }, []);
}

/** Если первые 2 секунды кадры проседают, выключаем частицы. */
function useFpsOk(): boolean {
  const [ok, setOk] = useState(true);
  const framesRef = useRef(0);

  useEffect(() => {
    let raf = 0;
    const started = performance.now();
    const tick = () => {
      framesRef.current += 1;
      const elapsed = performance.now() - started;
      if (elapsed < 2000) {
        raf = window.requestAnimationFrame(tick);
        return;
      }
      if (framesRef.current / (elapsed / 1000) < 45) setOk(false);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, []);

  return ok;
}

export default function Stage({ phase, round, children }: Props) {
  usePreload();
  const reduced = useReducedMotion();
  const particles = useFpsOk() && !reduced;
  const spec = roundSpec(round);
  const slow = isSlowMotion(phase);
  const corner = phase === 'corner' || phase === 'result';

  const zoom = phase === 'windup' || slow ? spec.cameraZoom : 1;

  return (
    <div
      className="stage"
      data-phase={phase}
      data-round={round}
      data-slow={slow ? 'on' : 'off'}
      data-spot={spec.singleSpot ? 'on' : 'off'}
    >
      <div className="stage-camera" style={{ transform: `scale(${zoom})` }}>
        <div className={corner ? 'layer-bg layer-bg--corner' : 'layer-bg'} />
        <div className="layer-grade" style={{ background: spec.overlay }} />

        {!corner ? (
          <>
            <Fighter side="igor" pose={igorPose(phase, round)} />
            <Fighter side="student" pose={studentPose(phase)} />
            <FistPov phase={phase} />
          </>
        ) : (
          <Fighter side="igor" pose="idle" />
        )}

        {particles ? <div className="layer-dust" aria-hidden="true" /> : null}
        <div
          className="layer-vignette"
          style={{ opacity: slow ? 0.85 : spec.vignette }}
          aria-hidden="true"
        />
        <div className="layer-flash" aria-hidden="true" />
      </div>

      <div className="stage-ui">{children}</div>
    </div>
  );
}
