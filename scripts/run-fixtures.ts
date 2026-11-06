/**
 * Прогон 15 заявок из data/pitches.json и сверка статусов с разделом 12 ТЗ.
 *
 *   npm run fixtures                     — детерминированный предфильтр
 *   FIXTURES_API=1 npm run fixtures      — плюс /api/start на запущенном сервере
 *   FIXTURES_API=1 FIXTURES_URL=http://host npm run fixtures
 *
 * Запускается через vitest, чтобы не тянуть отдельный раннер TypeScript.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { preFilter } from '../lib/server/classify';

type Pitch = { id: string; title: string; text: string };
type Status = 'too_little' | 'not_a_pitch' | 'manipulation_only' | 'ok';

/** Раздел 12 ТЗ. Для 14 допустимы оба исхода: балл не ставится в любом случае. */
const EXPECTED: Record<string, Status[]> = {
  '02': ['ok'],
  '03': ['ok'],
  '04': ['too_little'],
  '09': ['not_a_pitch'],
  '11': ['ok'],
  '13': ['ok'],
  '14': ['too_little', 'manipulation_only'],
};

const useApi = process.env.FIXTURES_API === '1';
const baseUrl = process.env.FIXTURES_URL ?? 'http://127.0.0.1:3000';
const pitches = JSON.parse(readFileSync('data/pitches.json', 'utf8')) as Pitch[];

async function statusOf(pitch: Pitch): Promise<string> {
  if (preFilter(pitch.text).status === 'too_little') return 'too_little';
  if (!useApi) return 'ok';

  const res = await fetch(`${baseUrl}/api/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pitch: pitch.text }),
  });
  const data = (await res.json()) as { status?: string; error?: string };
  return data.status ?? data.error ?? `http_${res.status}`;
}

describe('датасет из 15 заявок', () => {
  it('в data/pitches.json ровно 15 непустых питчей', () => {
    expect(pitches).toHaveLength(15);
    expect(pitches.every((p) => p.text.trim().length > 0)).toBe(true);
  });

  it(useApi ? `статусы через ${baseUrl}` : 'статусы предфильтра', async () => {
    const report: string[] = [];
    const mismatches: string[] = [];

    for (const pitch of pitches) {
      const status = await statusOf(pitch);
      const expected = EXPECTED[pitch.id];
      // not_a_pitch и manipulation_only решает LLM-классификатор в /api/start.
      // Без FIXTURES_API=1 проверяем только то, что решает сам предфильтр:
      // «мало текста» и «питч прошёл дальше».
      const decidable =
        expected !== undefined &&
        (useApi ||
          (expected.length === 1 && (expected[0] === 'too_little' || expected[0] === 'ok')));
      const needsApi = expected !== undefined && !decidable;

      let mark = '  ';
      if (expected && !needsApi) {
        const ok = expected.includes(status as Status);
        mark = ok ? 'ok' : 'XX';
        if (!ok) mismatches.push(`${pitch.id} ${pitch.title}: ${status}, ждали ${expected.join(' | ')}`);
      } else if (needsApi) {
        mark = '~~';
      }
      const want = expected ? `  (ждём: ${expected.join(' | ')})` : '';
      report.push(`${mark} ${pitch.id} ${pitch.title.padEnd(16)} -> ${status}${want}`);
    }

    console.log(`\n${useApi ? 'предфильтр + API' : 'только предфильтр'}\n${report.join('\n')}\n`);
    expect(mismatches).toEqual([]);
  }, 120_000);
});
