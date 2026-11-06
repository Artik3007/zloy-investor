'use client';

/** HUD: раунд, стойка студента, респект Игоря, кнопка звука. */

import { MAX_RESPECT, START_STANCE, TOTAL_ROUNDS } from '@/lib/fight/machine';
import { roundSpec } from '@/lib/fight/timeline';

type Props = {
  round: number;
  stance: number;
  respect: number;
  soundOn: boolean;
  onToggleSound: () => void;
};

export default function Hud({ round, stance, respect, soundOn, onToggleSound }: Props) {
  const spec = roundSpec(round);
  const pct = Math.round((stance / START_STANCE) * 100);

  return (
    <div className="hud">
      <div className="hud-row">
        <span className="hud-round">
          Раунд {round}/{TOTAL_ROUNDS}
        </span>
        <span className="hud-punch">{spec.punchName}</span>
        <button
          type="button"
          className="hud-sound"
          onClick={onToggleSound}
          aria-pressed={soundOn}
          aria-label={soundOn ? 'Выключить звук' : 'Включить звук'}
        >
          {soundOn ? '🔊' : '🔇'}
        </button>
      </div>

      <div className="hud-bars">
        <div className="hud-bar">
          <span className="hud-label">Стойка</span>
          <div
            className="bar"
            role="meter"
            aria-valuenow={stance}
            aria-valuemin={0}
            aria-valuemax={START_STANCE}
            aria-label={`Стойка студента: ${stance} из ${START_STANCE}`}
          >
            <i className="bar-tail" style={{ width: `${pct}%` }} />
            <i className="bar-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="hud-bar">
          <span className="hud-label">Респект</span>
          <div className="pips" aria-label={`Респект Игоря: ${respect} из ${MAX_RESPECT}`}>
            {Array.from({ length: MAX_RESPECT }, (_, i) => (
              <i key={i} className={i < respect ? 'pip pip--on' : 'pip'} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
