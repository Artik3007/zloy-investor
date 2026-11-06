/**
 * Карточка для сторис: PNG 1080×1920 рисуется на клиенте.
 * На карточке нет текста питча, ответов и названия проекта.
 */

import { CRITERIA } from './criteria';
import { getRank } from './rank';
import {
  AXIS_COUNT,
  labelAnchor,
  labelPoint,
  polygon,
  ring,
  spoke,
  valueOf,
} from './radar-geometry';
import type { Point } from './radar-geometry';
import { makeQrDataUrl, shortHost } from './qr';
import type { CriterionResult } from './schemas';

export const CARD_W = 1080;
export const CARD_H = 1920;

export type StoryCardInput = {
  total: number;
  criteria: CriterionResult[];
  quote: string;
  appUrl: string;
};

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Перенос по словам, максимум 4 строки, дальше многоточие. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 4): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && line) lines.push(line);

  if (lines.length === maxLines) {
    const consumed = lines.join(' ').split(/\s+/).length;
    if (consumed < words.length) {
      let last = lines[maxLines - 1] ?? '';
      while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
        last = last.slice(0, -1);
      }
      lines[maxLines - 1] = `${last}…`;
    }
  }
  return lines;
}

function drawRadar(
  ctx: CanvasRenderingContext2D,
  criteria: CriterionResult[],
  center: Point,
  radius: number,
  color: string,
): void {
  const trace = (points: Point[]) => {
    ctx.beginPath();
    points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
  };

  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,.22)';
  for (const level of [1, 2, 3]) {
    trace(ring(level, center, radius));
    ctx.stroke();
  }

  for (let i = 0; i < AXIS_COUNT; i += 1) {
    const [a, b] = spoke(i, center, radius);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  const values = criteria.map((c) => valueOf(c.score, c.max));
  trace(polygon(values, center, radius));
  ctx.fillStyle = `${color}55`;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = color;
  ctx.stroke();

  ctx.font = `500 26px ${FONT}`;
  ctx.fillStyle = 'rgba(238,242,255,.85)';
  ctx.textBaseline = 'middle';
  criteria.forEach((c, i) => {
    const p = labelPoint(i, center, radius + 48);
    const anchor = labelAnchor(i);
    ctx.textAlign = anchor === 'middle' ? 'center' : anchor;
    ctx.fillText(CRITERIA.find((x) => x.id === c.id)?.short ?? '', p.x, p.y);
  });
}

export async function renderStoryCard(input: StoryCardInput): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');

  try {
    await document.fonts.ready;
  } catch {
    // Шрифты системные: если проверка недоступна, рисуем как есть.
  }

  const rank = getRank(input.total);

  // фон
  const bg = ctx.createLinearGradient(0, 0, 0, CARD_H);
  bg.addColorStop(0, '#0d1428');
  bg.addColorStop(1, '#05070f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  const glow = ctx.createRadialGradient(540, 320, 40, 540, 320, 700);
  glow.addColorStop(0, `${rank.color}33`);
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // заголовок
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#eef2ff';
  ctx.font = `800 74px ${FONT}`;
  ctx.fillText('ЗЛОЙ ИНВЕСТОР', 540, 170);
  ctx.font = `500 32px ${FONT}`;
  ctx.fillStyle = 'rgba(163,173,201,.95)';
  ctx.fillText('прожарка стартапа', 540, 220);

  // значок ранга: круг с первой буквой, без эмодзи
  ctx.beginPath();
  ctx.arc(250, 400, 96, 0, Math.PI * 2);
  ctx.fillStyle = `${rank.color}2e`;
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = rank.color;
  ctx.stroke();
  ctx.fillStyle = rank.color;
  ctx.font = `800 96px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.fillText(rank.title.slice(0, 1), 250, 408);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#eef2ff';
  ctx.font = `800 82px ${FONT}`;
  ctx.fillText(rank.title, 388, 366);
  ctx.font = `600 38px ${FONT}`;
  ctx.fillStyle = rank.color;
  ctx.fillText(rank.doneness, 388, 424);
  ctx.font = `700 54px ${FONT}`;
  ctx.fillStyle = 'rgba(238,242,255,.92)';
  ctx.fillText(`${Math.round(Math.min(Math.max(input.total, 0), 100))} / 100`, 388, 492);

  // радар
  drawRadar(ctx, input.criteria, { x: 540, y: 1000 }, 330, rank.color);

  // цитата
  const quote = (input.quote || rank.tagline).trim();
  ctx.font = `500 40px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#eef2ff';
  const lines = wrap(ctx, `«${quote}»`, 880, 4);
  lines.forEach((line, i) => ctx.fillText(line, 540, 1460 + i * 54));

  // футер с QR
  const footerY = 1672;
  ctx.fillStyle = '#ffffff';
  roundedRect(ctx, 80, footerY, 920, 180, 28);
  ctx.fill();

  const qr = await makeQrDataUrl(input.appUrl, 256);
  const img = new window.Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('qr render failed'));
    img.src = qr;
  });
  ctx.drawImage(img, 104, footerY + 18, 144, 144);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#0b1020';
  ctx.font = `700 44px ${FONT}`;
  ctx.fillText('Прожарь свой стартап', 280, footerY + 78);
  ctx.font = `500 32px ${FONT}`;
  ctx.fillStyle = '#4a5570';
  ctx.fillText(shortHost(input.appUrl), 280, footerY + 128);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('toBlob failed'));
    }, 'image/png');
  });
}
