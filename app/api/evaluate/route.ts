/** POST /api/evaluate — оценка по 10 критериям, total_100 и 3 совета. */

import { adviceLlmSchema, criteriaLlmSchema, evaluateReqSchema } from '@/lib/schemas';
import type { Advice, EvaluateRes } from '@/lib/schemas';
import { allValid, normalizeAdvice } from '@/lib/server/advice';
import { detectManipulation } from '@/lib/server/classify';
import { FALLBACK_ERROR_LINE, FALLBACK_VERDICT, fallbackAdvice } from '@/lib/server/fallbacks';
import { badRequest, guardRate, readJsonBody } from '@/lib/server/http';
import { callJson, LlmError } from '@/lib/server/llm';
import { adviceTask, CRITERIA_TASK, PERSONA, wrapAnswers, wrapPitch } from '@/lib/server/prompts';
import { buildCriteria, totalScore, weakestThree } from '@/lib/server/scoring';
import { checkLine } from '@/lib/server/sanitize';

export async function POST(req: Request): Promise<Response> {
  const limited = guardRate(req);
  if (limited) return limited;

  const body = await readJsonBody(req);
  if (!body.ok) return badRequest(body.message, body.status);

  const parsed = evaluateReqSchema.safeParse(body.value);
  if (!parsed.success) {
    return badRequest('Нужен питч и ровно 5 ответов');
  }
  const { pitch, answers } = parsed.data;

  const transcript = `${wrapPitch(pitch)}\n${wrapAnswers(answers)}`;

  let criteriaLlm;
  try {
    criteriaLlm = await callJson({
      system: PERSONA,
      user: `${transcript}\n\n${CRITERIA_TASK}`,
      schema: criteriaLlmSchema,
      maxTokens: 2500,
      temperature: 0.2,
      task: 'criteria',
    });
  } catch (err) {
    console.warn('[evaluate] criteria failed:', err instanceof LlmError ? err.kind : 'unknown');
    return Response.json(
      { error: 'llm_unavailable', investor_line: FALLBACK_ERROR_LINE },
      { status: 503 },
    );
  }

  // Цитаты проверяет код: неподтверждённые оценки обнуляются.
  const { criteria, warnings } = buildCriteria(criteriaLlm, pitch, answers);
  if (warnings.length > 0) {
    // Без текста питча и ответов: только id критериев и причина.
    console.warn('[evaluate] evidence rejected:', JSON.stringify(warnings));
  }

  const total = totalScore(criteria);
  const weakest = weakestThree(criteria);

  // Советы просим отдельным вызовом: три самых слабых критерия считает код.
  let advice: Advice[];
  try {
    const adviceLlm = await callJson({
      system: PERSONA,
      user: `${transcript}\n\n${adviceTask(weakest.map((c) => ({ id: c.id, name: c.name })))}`,
      schema: adviceLlmSchema,
      maxTokens: 1200,
      temperature: 0.2,
      task: 'advice',
    });
    const normalized = normalizeAdvice(adviceLlm);
    advice = allValid(normalized) ? normalized : fallbackAdvice(weakest.map((c) => c.id));
  } catch (err) {
    console.warn('[evaluate] advice failed:', err instanceof LlmError ? err.kind : 'unknown');
    advice = fallbackAdvice(weakest.map((c) => c.id));
  }

  const verdict = checkLine(criteriaLlm.verdict_line, 140);

  const res: EvaluateRes = {
    criteria,
    total_100: total,
    verdict_line: verdict.ok ? verdict.value : FALLBACK_VERDICT,
    advice,
    flags: { manipulation_detected: detectManipulation([pitch, ...answers]) },
  };
  return Response.json(res);
}
