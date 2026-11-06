/**
 * Адаптер провайдера LLM. Без SDK, только fetch.
 * Ключ читается из окружения, в клиент не уходит и в логи не пишется.
 */

import type { z } from 'zod';
import { mockJson } from './mock';

export type LlmTask = 'start' | 'question' | 'criteria' | 'advice';
export type Provider = 'anthropic' | 'openai-compatible' | 'mock';

const TIMEOUT_MS = 25_000;

export class LlmError extends Error {
  readonly kind: 'config' | 'network' | 'http' | 'parse' | 'schema';
  constructor(kind: LlmError['kind'], message: string) {
    super(message);
    this.name = 'LlmError';
    this.kind = kind;
  }
}

export function currentProvider(): Provider {
  const raw = (process.env.LLM_PROVIDER ?? 'mock').trim();
  if (raw === 'anthropic' || raw === 'openai-compatible' || raw === 'mock') {
    return raw;
  }
  throw new LlmError('config', `unknown LLM_PROVIDER: ${raw}`);
}

type CallArgs<T> = {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  maxTokens: number;
  temperature: number;
  task: LlmTask;
};

/** Вырезает JSON из ответа: модель иногда оборачивает его в markdown-забор. */
function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced?.[1] ?? raw).trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new LlmError('parse', 'no json object in model output');
  }
  return body.slice(start, end + 1);
}

async function fetchJsonText(args: CallArgs<unknown>, provider: Provider): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const key = process.env.LLM_API_KEY?.trim();
    const model = process.env.LLM_MODEL?.trim();
    if (!key) throw new LlmError('config', 'LLM_API_KEY is not set');
    if (!model) throw new LlmError('config', 'LLM_MODEL is not set');

    const url =
      provider === 'anthropic'
        ? 'https://api.anthropic.com/v1/messages'
        : `${(process.env.LLM_BASE_URL ?? '').trim().replace(/\/+$/, '')}/chat/completions`;

    if (provider === 'openai-compatible' && !process.env.LLM_BASE_URL?.trim()) {
      throw new LlmError('config', 'LLM_BASE_URL is required for openai-compatible');
    }

    const headers: Record<string, string> =
      provider === 'anthropic'
        ? {
            'content-type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
          }
        : {
            'content-type': 'application/json',
            authorization: `Bearer ${key}`,
          };

    const body =
      provider === 'anthropic'
        ? {
            model,
            max_tokens: args.maxTokens,
            temperature: args.temperature,
            system: args.system,
            messages: [{ role: 'user', content: args.user }],
          }
        : {
            model,
            max_tokens: args.maxTokens,
            temperature: args.temperature,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: args.system },
              { role: 'user', content: args.user },
            ],
          };

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      // Тело ошибки не логируем целиком: там может быть эхо запроса.
      throw new LlmError('http', `provider http ${res.status}`);
    }

    const data: unknown = await res.json();
    const text =
      provider === 'anthropic'
        ? extractAnthropicText(data)
        : extractOpenAiText(data);

    if (!text) throw new LlmError('parse', 'empty model output');
    return text;
  } catch (err) {
    if (err instanceof LlmError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new LlmError('network', 'provider timeout');
    }
    throw new LlmError('network', 'provider request failed');
  } finally {
    clearTimeout(timer);
  }
}

function extractAnthropicText(data: unknown): string {
  if (typeof data !== 'object' || data === null) return '';
  const content = (data as { content?: unknown }).content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part) =>
      typeof part === 'object' && part !== null && 'text' in part
        ? String((part as { text?: unknown }).text ?? '')
        : '',
    )
    .join('');
}

function extractOpenAiText(data: unknown): string {
  if (typeof data !== 'object' || data === null) return '';
  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return '';
  const message = (choices[0] as { message?: { content?: unknown } }).message;
  return typeof message?.content === 'string' ? message.content : '';
}

/**
 * Один вызов: запрос → JSON.parse → валидация zod.
 * При невалидном JSON или схеме делается ровно один повтор.
 */
export async function callJson<T>(args: CallArgs<T>): Promise<T> {
  const provider = currentProvider();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const text =
      provider === 'mock'
        ? mockJson(args.task, args.user)
        : await fetchJsonText(args as CallArgs<unknown>, provider);

    try {
      const parsed: unknown = JSON.parse(extractJson(text));
      const result = args.schema.safeParse(parsed);
      if (result.success) return result.data;
      if (attempt === 1) {
        throw new LlmError('schema', `schema mismatch for task ${args.task}`);
      }
    } catch (err) {
      if (err instanceof LlmError && err.kind === 'schema') throw err;
      if (attempt === 1) {
        throw new LlmError('parse', `invalid json for task ${args.task}`);
      }
    }
  }

  throw new LlmError('parse', `invalid json for task ${args.task}`);
}
