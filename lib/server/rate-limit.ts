/**
 * Лимит запросов в памяти процесса: 30 запросов на IP за 10 минут.
 *
 * ОГРАНИЧЕНИЕ: в serverless каждый инстанс держит свою карту, и инстансы
 * перезапускаются, поэтому лимит мягкий — он сбивает случайный флуд и
 * повторные клики, но не является защитой от распределённой атаки.
 * Для продакшена нужен внешний счётчик (Redis / KV).
 */

const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 30;
const MAX_KEYS = 5000;

const hits = new Map<string, number[]>();

export function rateLimit(key: string, now = Date.now()): { ok: boolean; retryAfter: number } {
  const fresh = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);

  if (fresh.length >= LIMIT) {
    const oldest = fresh[0] ?? now;
    return { ok: false, retryAfter: Math.ceil((WINDOW_MS - (now - oldest)) / 1000) };
  }

  fresh.push(now);
  hits.set(key, fresh);

  // Простая защита карты от разрастания.
  if (hits.size > MAX_KEYS) {
    for (const [k, times] of hits) {
      const last = times[times.length - 1];
      if (last === undefined || now - last >= WINDOW_MS) hits.delete(k);
    }
  }

  return { ok: true, retryAfter: 0 };
}

/** Клиентский IP из заголовков прокси. Для лимита, в логи не пишем. */
export function clientKey(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('x-real-ip') ?? 'unknown';
}

/** Только для тестов. */
export function resetRateLimit(): void {
  hits.clear();
}
