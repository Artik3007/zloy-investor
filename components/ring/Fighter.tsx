'use client';

/**
 * Боец: PNG-спрайт из public/ring, а пока ассетов нет — SVG-силуэт в той же
 * позе. Холст и линия стоп одинаковы во всех позах, поэтому смена позы
 * не «прыгает» (раздел 9.1 ТЗ).
 */

import type { IgorPose, StudentPose } from '@/lib/fight/timeline';
import { useSprite } from './use-sprite';

type Side = 'igor' | 'student';

type Props = {
  side: Side;
  pose: IgorPose | StudentPose;
};

const SRC: Record<string, string> = {
  'igor-idle': '/ring/igor-idle.png',
  'igor-windup': '/ring/igor-windup.png',
  'igor-jab': '/ring/igor-jab.png',
  'igor-hook': '/ring/igor-hook.png',
  'igor-uppercut': '/ring/igor-uppercut.png',
  'igor-impressed': '/ring/igor-impressed.png',
  'student-idle': '/ring/student-idle.png',
  'student-dodge': '/ring/student-dodge.png',
  'student-hit': '/ring/student-hit.png',
};

const LABEL: Record<string, string> = {
  'igor-idle': 'Игорь в спокойной стойке',
  'igor-windup': 'Игорь делает замах',
  'igor-jab': 'Игорь бьёт прямой',
  'igor-hook': 'Игорь бьёт боковой',
  'igor-uppercut': 'Игорь бьёт снизу вверх',
  'igor-impressed': 'Игорь удивлён и одобрительно улыбается',
  'student-idle': 'Студент в боевой стойке',
  'student-dodge': 'Студент уворачивается',
  'student-hit': 'Студент принимает удар',
};

/** Геометрия рук и наклона корпуса для каждой позы. */
type PoseGeom = {
  tilt: number;
  headX: number;
  headY: number;
  frontArm: string;
  backArm: string;
  frontGlove: [number, number];
  backGlove: [number, number];
};

const GEOM: Record<string, PoseGeom> = {
  idle: {
    tilt: 0,
    headX: 150,
    headY: 74,
    frontArm: 'M126 170 L104 212 L118 244',
    backArm: 'M176 170 L198 210 L186 240',
    frontGlove: [118, 252],
    backGlove: [186, 248],
  },
  windup: {
    tilt: -5,
    headX: 158,
    headY: 76,
    frontArm: 'M126 170 L96 206 L108 236',
    backArm: 'M176 168 L214 190 L226 158',
    frontGlove: [108, 244],
    backGlove: [230, 148],
  },
  jab: {
    tilt: 3,
    headX: 146,
    headY: 76,
    frontArm: 'M126 172 L72 162 L24 152',
    backArm: 'M176 170 L196 206 L184 234',
    frontGlove: [12, 150],
    backGlove: [184, 242],
  },
  hook: {
    tilt: 6,
    headX: 144,
    headY: 78,
    frontArm: 'M126 172 L80 128 L34 134',
    backArm: 'M176 172 L202 200 L188 228',
    frontGlove: [22, 136],
    backGlove: [188, 236],
  },
  uppercut: {
    tilt: -4,
    headX: 152,
    headY: 72,
    frontArm: 'M126 176 L92 206 L48 150',
    backArm: 'M176 170 L200 200 L188 230',
    frontGlove: [38, 136],
    backGlove: [188, 238],
  },
  impressed: {
    tilt: 0,
    headX: 150,
    headY: 70,
    frontArm: 'M126 170 L90 196 L72 168',
    backArm: 'M176 170 L212 196 L230 168',
    frontGlove: [64, 158],
    backGlove: [238, 158],
  },
  dodge: {
    tilt: -16,
    headX: 112,
    headY: 92,
    frontArm: 'M126 176 L98 214 L112 242',
    backArm: 'M176 174 L206 204 L198 236',
    frontGlove: [112, 250],
    backGlove: [198, 244],
  },
  hit: {
    tilt: 12,
    headX: 176,
    headY: 58,
    frontArm: 'M126 176 L96 222 L84 254',
    backArm: 'M176 176 L214 214 L224 246',
    frontGlove: [82, 262],
    backGlove: [226, 254],
  },
};

/** Силуэт-заглушка: обычные формы без деталей лица. */
function Silhouette({ side, pose }: { side: Side; pose: string }) {
  const g = GEOM[pose] ?? GEOM.idle;
  if (!g) return null;
  const body = side === 'igor' ? 'var(--c-rope-blue)' : 'var(--c-rope-red)';
  const skin = side === 'igor' ? '#2f3f63' : '#5c2634';

  return (
    <svg
      viewBox="0 0 300 400"
      className="fighter-svg"
      role="img"
      aria-label={LABEL[`${side}-${pose}`] ?? 'Боец на ринге'}
    >
      <g transform={`rotate(${g.tilt} 150 240)`}>
        {/* ноги: линия стоп одна и та же во всех позах */}
        <path d="M134 268 L124 388" stroke={skin} strokeWidth="26" strokeLinecap="round" fill="none" />
        <path d="M168 268 L182 388" stroke={skin} strokeWidth="26" strokeLinecap="round" fill="none" />
        {/* корпус */}
        <path
          d="M118 160 Q150 142 182 160 L190 266 Q150 280 110 266 Z"
          fill={body}
        />
        {/* руки */}
        <path d={g.backArm} stroke={skin} strokeWidth="20" strokeLinecap="round" fill="none" />
        <path d={g.frontArm} stroke={skin} strokeWidth="22" strokeLinecap="round" fill="none" />
        {/* голова */}
        <circle cx={g.headX} cy={g.headY} r="34" fill={skin} />
        {/* перчатки */}
        <circle cx={g.backGlove[0]} cy={g.backGlove[1]} r="21" fill={body} stroke="#0b1020" strokeWidth="3" />
        <circle cx={g.frontGlove[0]} cy={g.frontGlove[1]} r="23" fill={body} stroke="#0b1020" strokeWidth="3" />
      </g>
    </svg>
  );
}

export default function Fighter({ side, pose }: Props) {
  const key = `${side}-${pose}`;
  const src = SRC[key];
  const hasAsset = useSprite(src);

  return (
    <div className={`fighter fighter--${side}`} data-pose={pose}>
      {hasAsset && src ? (
        <img
          src={src}
          alt={LABEL[key] ?? 'Боец на ринге'}
          className="fighter-img"
          draggable={false}
        />
      ) : (
        <Silhouette side={side} pose={pose} />
      )}
    </div>
  );
}
