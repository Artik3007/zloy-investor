/** Общее для маршрутов: лимит тела, чтение JSON, ответы об ошибке. */

import { MAX_BODY_BYTES } from '../schemas';
import { clientKey, rateLimit } from './rate-limit';

export type BodyResult =
  | { ok: true; value: unknown }
  | { ok: false; status: number; message: string };

export async function readJsonBody(req: Request): Promise<BodyResult> {
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return { ok: false, status: 413, message: 'Запрос слишком большой' };
  }

  let text: string;
  try {
    text = await req.text();
  } catch {
    return { ok: false, status: 400, message: 'Не удалось прочитать запрос' };
  }

  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return { ok: false, status: 413, message: 'Запрос слишком большой' };
  }

  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, status: 400, message: 'Ожидался JSON' };
  }
}

export function guardRate(req: Request): Response | null {
  const { ok, retryAfter } = rateLimit(clientKey(req.headers));
  if (ok) return null;
  return Response.json(
    { error: 'rate_limited', message: 'Слишком много запросов. Передохни минуту.' },
    { status: 429, headers: { 'retry-after': String(retryAfter) } },
  );
}

export function badRequest(message: string, status = 400): Response {
  return Response.json({ error: 'bad_request', message }, { status });
}
