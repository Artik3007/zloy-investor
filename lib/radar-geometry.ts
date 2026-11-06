/**
 * Геометрия радара. Чистые функции без React и DOM: тот же код рисует
 * SVG на экране итога и canvas в карточке для сторис (фишка 4).
 */

export type Point = { x: number; y: number };

export const AXIS_COUNT = 10;
export const VIEWBOX = 400;
export const CENTER: Point = { x: 200, y: 200 };
export const RADIUS = 128;
export const LABEL_RADIUS = 162;
export const LEVELS = [1, 2, 3] as const;

/** Ось 1 сверху, дальше по часовой стрелке. */
export function axisAngle(index: number): number {
  return -Math.PI / 2 + (index * 2 * Math.PI) / AXIS_COUNT;
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function valueOf(score: number, max: number): number {
  if (!Number.isFinite(score) || !Number.isFinite(max) || max <= 0) return 0;
  return clamp01(score / max);
}

export function pointAt(
  index: number,
  value: number,
  center: Point = CENTER,
  radius: number = RADIUS,
): Point {
  const angle = axisAngle(index);
  const r = radius * clamp01(value);
  return { x: center.x + r * Math.cos(angle), y: center.y + r * Math.sin(angle) };
}

export function polygon(
  values: readonly number[],
  center: Point = CENTER,
  radius: number = RADIUS,
): Point[] {
  return values.map((v, i) => pointAt(i, v, center, radius));
}

/** Кольцо сетки для уровня 1..3. */
export function ring(
  level: number,
  center: Point = CENTER,
  radius: number = RADIUS,
): Point[] {
  const value = level / LEVELS.length;
  return Array.from({ length: AXIS_COUNT }, (_, i) => pointAt(i, value, center, radius));
}

export function spoke(
  index: number,
  center: Point = CENTER,
  radius: number = RADIUS,
): [Point, Point] {
  return [center, pointAt(index, 1, center, radius)];
}

export function labelPoint(
  index: number,
  center: Point = CENTER,
  radius: number = LABEL_RADIUS,
): Point {
  return pointAt(index, 1, center, radius);
}

/** Выравнивание подписи, чтобы она не наезжала на радар. */
export function labelAnchor(index: number): 'start' | 'middle' | 'end' {
  const x = Math.cos(axisAngle(index));
  if (x > 0.25) return 'start';
  if (x < -0.25) return 'end';
  return 'middle';
}

export function toPoints(points: readonly Point[]): string {
  return points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
}
