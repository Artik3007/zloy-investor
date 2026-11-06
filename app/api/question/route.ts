/** POST /api/question — исход предыдущего удара и следующий вопрос. */

import { questionLlmSchema, questionReqSchema, themeForRound } from '@/lib/schemas';
import type { Punch, QuestionRes, ThemeId } from '@/lib/schemas';
import { FALLBACK_ERROR_LINE, FALLBACK_QUESTIONS, fallbackReaction } from '@/lib/server/fallbacks';
import { badRequest, guardRate, readJsonBody } from '@/lib/server/http';
import { callJson, LlmError } from '@/lib/server/llm';
import { PERSONA, questionTask, wrapAnswers, wrapPitch } from '@/lib/server/prompts';
import { checkLine, checkQuestion } from '@/lib/server/sanitize';

export async function POST(req: Request): Promise<Response> {
  const limited = guardRate(req);
  if (limited) return limited;

  const body = await readJsonBody(req);
  if (!body.ok) return badRequest(body.message, body.status);

  const parsed = questionReqSchema.safeParse(body.value);
  if (!parsed.success) {
    return badRequest('Нужен питч и от 1 до 5 ответов по 1200 символов');
  }
  const { pitch, answers } = parsed.data;

  // Раунд определяется кодом по числу ответов, а не присланным значением.
  const roundJustAnswered = answers.length;
  const nextTheme: ThemeId | null =
    roundJustAnswered >= 5 ? null : themeForRound(roundJustAnswered + 1);

  try {
    const llm = await callJson({
      system: PERSONA,
      user: `${wrapPitch(pitch)}\n${wrapAnswers(answers)}\n\n${questionTask(
        roundJustAnswered,
        nextTheme,
      )}`,
      schema: questionLlmSchema,
      maxTokens: 700,
      temperature: 0.7,
      task: 'question',
    });

    // Исход определяет код по answer_strength, а не слово модели.
    const punch: Punch = llm.answer_strength >= 2 ? 'parry' : 'hit';

    const line = checkLine(llm.reaction_line, 180);
    const nextQuestion = nextTheme === null ? null : checkQuestion(llm.next_question ?? '');

    const res: QuestionRes = {
      reaction: {
        punch,
        line: line.ok ? line.value : fallbackReaction(llm.reason),
        reason: llm.reason,
      },
      next:
        nextTheme === null
          ? null
          : {
              round: (roundJustAnswered + 1) as 2 | 3 | 4 | 5,
              theme: nextTheme,
              text:
                nextQuestion && nextQuestion.ok
                  ? nextQuestion.value
                  : FALLBACK_QUESTIONS[nextTheme],
            },
    };
    return Response.json(res);
  } catch (err) {
    console.warn('[question] llm failed:', err instanceof LlmError ? err.kind : 'unknown');
    return Response.json(
      { error: 'llm_unavailable', investor_line: FALLBACK_ERROR_LINE },
      { status: 503 },
    );
  }
}
