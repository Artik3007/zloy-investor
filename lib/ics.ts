/** Один .ics с тремя событиями на целый день. RFC 5545. */

import type { Advice } from './schemas';

function escapeText(raw: string): string {
  return raw
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Длинные строки складываем по 75 октетов, продолжение начинается с пробела. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;

  const parts: string[] = [];
  let current = '';
  let size = 0;
  for (const char of line) {
    const charSize = new TextEncoder().encode(char).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (size + charSize > limit) {
      parts.push(current);
      current = char;
      size = charSize;
    } else {
      current += char;
      size += charSize;
    }
  }
  if (current) parts.push(current);
  return parts.join('\r\n ');
}

function dateStamp(date: Date): string {
  return `${date.toISOString().slice(0, 19).replace(/[-:]/g, '')}Z`;
}

function dayValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/** Дедлайн вне 1..7 и NaN заменяем на 1. */
function safeDeadline(days: number): number {
  if (!Number.isFinite(days)) return 1;
  const n = Math.round(days);
  if (n < 1 || n > 7) return 1;
  return n;
}

export function buildIcs(advice: readonly Advice[], now = new Date()): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Zloy Investor//Advice//RU',
    'CALSCALE:GREGORIAN',
  ];

  advice.forEach((item, i) => {
    const due = new Date(now);
    due.setDate(due.getDate() + safeDeadline(item.deadline_days));
    const description = [item.why, item.done_when].filter(Boolean).join(' ');

    lines.push(
      'BEGIN:VEVENT',
      `UID:zi-${dayValue(now)}-${i + 1}@zloy-investor`,
      `DTSTAMP:${dateStamp(now)}`,
      `DTSTART;VALUE=DATE:${dayValue(due)}`,
      fold(`SUMMARY:${escapeText(item.action)}`),
      fold(`DESCRIPTION:${escapeText(description)}`),
      'END:VEVENT',
    );
  });

  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

export function icsFileName(): string {
  return 'zloy-investor-sovety.ics';
}
