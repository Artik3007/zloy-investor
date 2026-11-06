/** POST /api/start — классификация входа и первый вопрос. */

import { startLlmSchema, startReqSchema } from '@/lib/schemas';
import type { StartRes } from '@/lib/schemas';
import { preFilter } from '@/lib/server/classify';
import { FALLBACK_ERROR_LINE, FALLBACK_INVESTOR_LINES, FALLBACK_QUESTIONS } from '@/lib/server/fallbacks';
import { badRequest, guardRate, readJsonBody } from '@/lib/server/http';
import { callJson, LlmError } from '@/lib/server/llm';
import { PERSONA, START_TASK, wrapPitch } from '@/lib/server/prompts';
import { checkLine, checkQuestion } from '@/lib/server/sanitize';

export async function POST(req: Request): Promise<Response> {
  const limited = guardRate(req);
  if (limited) return limited;

  const body = await readJsonBody(req);
  if (!body.ok) return badRequest(body.message, body.status);

  const parsed = startReqSchema.safeParse(body.value);
  if (!parsed.success) {
    return badRequest('Питч должен быть от 1 до 8000 символов');
  }
  const { pitch } = parsed.data;

  // Детерминированный шаг: слишком мало текста — модель не зовём вовсе.
  if (preFilter(pitch).status === 'too_little') {
    const res: StartRes = {
      status: 'too_little',
      investor_line: FALLBACK_INVESTOR_LINES.too_little,
    };
    return Response.json(res);
  }

  try {
    const llm = await callJson({
      system: PERSONA,
      user: `${wrapPitch(pitch)}\n\n${START_TASK}`,
      schema: startLlmSchema,
      maxTokens: 700,
      temperature: 0.7,
      task: 'start',
    });

    if (llm.status === 'not_a_pitch' || llm.status === 'manipulation_only') {
      const checked = checkLine(llm.investor_line, 160);
      const res: StartRes = {
        status: llm.status,
        investor_line: checked.ok ? checked.value : FALLBACK_INVESTOR_LINES[llm.status],
      };
      return Response.json(res);
    }

    const question = checkQuestion(llm.question);
    const res: StartRes = {
      status: 'ok',
      first: {
        round: 1,
        theme: 'client',
        text: question.ok ? question.value : FALLBACK_QUESTIONS.client,
      },
    };
    return Response.json(res);
  } catch (err) {
    // Логи без текста питча.
    console.warn('[start] llm failed:', err instanceof LlmError ? err.kind : 'unknown');
    return Response.json(
      { error: 'llm_unavailable', investor_line: FALLBACK_ERROR_LINE },
      { status: 503 },
    );
  }
}
