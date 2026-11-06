'use client';

/** Кулак от первого лица. PNG из public/ring, иначе SVG-перчатка. */

import type { Phase } from '@/lib/fight/timeline';
import { useSprite } from './use-sprite';

type Props = { phase: Phase };

function Glove() {
  return (
    <svg viewBox="0 0 400 400" className="fist-svg" aria-hidden="true">
      <defs>
        <radialGradient id="gloveLight" cx="38%" cy="30%" r="72%">
          <stop offset="0%" stopColor="#ff6b72" />
          <stop offset="60%" stopColor="#d7263d" />
          <stop offset="100%" stopColor="#7d1222" />
        </radialGradient>
      </defs>
      <circle cx="200" cy="196" r="150" fill="url(#gloveLight)" stroke="#480a16" strokeWidth="8" />
      {/* костяшки */}
      <g fill="#a61b2e" opacity="0.9">
        <circle cx="140" cy="150" r="30" />
        <circle cx="200" cy="134" r="32" />
        <circle cx="260" cy="150" r="30" />
      </g>
      {/* большой палец */}
      <path d="M96 240 Q58 232 62 272 Q68 310 112 296 Z" fill="#b51f33" stroke="#480a16" strokeWidth="6" />
      {/* манжета */}
      <path d="M118 318 Q200 356 282 318 L292 362 Q200 400 108 362 Z" fill="#f2f4ff" stroke="#480a16" strokeWidth="6" />
    </svg>
  );
}

export default function FistPov({ phase }: Props) {
  const hasAsset = useSprite('/ring/fist-pov.png');

  return (
    <div className="fist" data-phase={phase} aria-hidden="true">
      {hasAsset ? (
        <img
          src="/ring/fist-pov.png"
          alt=""
          className="fist-img"
          draggable={false}
        />
      ) : (
        <Glove />
      )}
    </div>
  );
}
