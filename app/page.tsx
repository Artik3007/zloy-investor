'use client';

/**
 * Старт → бой → итог → реванш. Клиентская машина состояний.
 * Сервер stateless: весь транскрипт живёт здесь и уходит с каждым запросом.
 */

import { Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'next/navigation';
import pitches from '@/data/pitches.json';
import AdviceChecklist from '@/components/AdviceChecklist';
import ComparisonSummary from '@/components/ComparisonSummary';
import Radar from '@/components/Radar';
import RankBadge from '@/components/RankBadge';
import StoryCardButton from '@/components/StoryCardButton';
import Hud from '@/components/ring/Hud';
import QuestionCard from '@/components/ring/QuestionCard';
import RoundBell from '@/components/ring/RoundBell';
import SpeechBubble from '@/components/ring/SpeechBubble';
import Stage from '@/components/ring/Stage';
import { fightReducer, initialFight, TOTAL_ROUNDS } from '@/lib/fight/machine';
import type { Reaction } from '@/lib/fight/machine';
import { JUDGING_MIN_MS, PHASE_MS, REACTION_HOLD_MS } from '@/lib/fight/timeline';
import { isSoundEnabled, playSfx, setSoundEnabled, soundServerSnapshot, subscribeSound } from '@/lib/fight/sfx';
import { compareRounds } from '@/lib/compare';
import { buildIcs, icsFileName } from '@/lib/ics';
import { ERROR_LINE, PRIVACY_NOTE, START_GREETING } from '@/lib/copy';
import {
  clearRound,
  roundServerSnapshot,
  roundSnapshot,
  saveRound,
  subscribeRound,
} from '@/lib/round-store';
import type { StoredRound } from '@/lib/round-store';
import { MAX_PITCH } from '@/lib/schemas';
import type { EvaluateRes, QuestionPayload, QuestionRes, StartRes } from '@/lib/schemas';

type Screen = 'start' | 'fight';

const EXAMPLE = pitches.find((p) => p.title === 'ЛабСклад')?.text ?? '';

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data: unknown = await res.json();
  if (!res.ok) {
    const message =
      typeof data === 'object' && data !== null && 'investor_line' in data
        ? String((data as { investor_line?: unknown }).investor_line)
        : ERROR_LINE;
    throw new Error(message);
  }
  return data as T;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function Fight() {
  const params = useSearchParams();
  const [screen, setScreen] = useState<Screen>('start');
  const [pitch, setPitch] = useState(() => {
    const id = params.get('p');
    return (id && pitches.find((p) => p.id === id)?.text) || '';
  });
  const [startLine, setStartLine] = useState<string | null>(null);
  const [startBusy, setStartBusy] = useState(false);
  const [fight, dispatch] = useReducer(fightReducer, initialFight);
  const [evaluation, setEvaluation] = useState<EvaluateRes | null>(null);
  /** Предыдущий раунд, снятый ДО сохранения текущего: основа сравнения. */
  const [baseline, setBaseline] = useState<StoredRound | null>(null);
  const savedRef = useRef(false);

  const soundOn = useSyncExternalStore(subscribeSound, isSoundEnabled, soundServerSnapshot);
  const stored = useSyncExternalStore(subscribeRound, roundSnapshot, roundServerSnapshot);

  const roundNumber = (baseline?.round ?? stored?.round ?? 0) + 1;

  // Фазы с фиксированной длительностью двигает таймер.
  useEffect(() => {
    const ms = PHASE_MS[fight.phase];
    if (ms === undefined) return;
    const timer = window.setTimeout(() => dispatch({ type: 'PHASE_DONE' }), ms);
    return () => window.clearTimeout(timer);
  }, [fight.phase, fight.round]);

  useEffect(() => {
    if (fight.phase === 'roundCard') void playSfx('gong');
    if (fight.phase === 'strike') void playSfx('whoosh');
    if (fight.phase === 'parry') void playSfx('dodge');
    if (fight.phase === 'hit') void playSfx('impact');
    if (fight.phase === 'corner') void playSfx('gong');
  }, [fight.phase]);

  // Сохраняем только завершённый раунд и только если оценка состоялась.
  useEffect(() => {
    if (fight.phase !== 'result' || !evaluation || savedRef.current) return;
    savedRef.current = true;
    saveRound({
      round: roundNumber,
      pitch,
      total: evaluation.total_100,
      criteria: evaluation.criteria,
      advice: evaluation.advice,
    });
  }, [fight.phase, evaluation, roundNumber, pitch]);

  const comparison = useMemo(() => {
    if (!evaluation || !baseline) return null;
    return compareRounds(baseline, {
      total: evaluation.total_100,
      criteria: evaluation.criteria,
      pitch,
    });
  }, [evaluation, baseline, pitch]);

  async function startFight() {
    const text = pitch.trim();
    if (text.length === 0 || startBusy) return;
    setStartBusy(true);
    setStartLine(null);

    try {
      const res = await postJson<StartRes>('/api/start', { pitch: text });
      if (res.status === 'ok') {
        setBaseline(stored);
        savedRef.current = false;
        setEvaluation(null);
        dispatch({ type: 'FIGHT_START', first: res.first });
        setScreen('fight');
      } else {
        // Отфильтрованный вход: бой не начинается, раунд не сохраняется.
        setStartLine(res.investor_line);
      }
    } catch (err) {
      setStartLine(err instanceof Error ? err.message : ERROR_LINE);
    } finally {
      setStartBusy(false);
    }
  }

  const judge = useCallback(async (pitchText: string, answers: string[]) => {
    const started = Date.now();
    const payload = { pitch: pitchText.trim(), answers };

    try {
      let reaction: Reaction;
      let next: QuestionPayload | null;

      if (answers.length === TOTAL_ROUNDS) {
        // На пятом ответе исход и оценка идут параллельно — экономим время.
        const [q, ev] = await Promise.all([
          postJson<QuestionRes>('/api/question', payload),
          postJson<EvaluateRes>('/api/evaluate', payload),
        ]);
        reaction = q.reaction;
        next = q.next;
        setEvaluation(ev);
      } else {
        const q = await postJson<QuestionRes>('/api/question', payload);
        reaction = q.reaction;
        next = q.next;
      }

      await wait(Math.max(0, JUDGING_MIN_MS - (Date.now() - started)));
      dispatch({ type: 'JUDGED', reaction, next });
    } catch (err) {
      dispatch({
        type: 'REQUEST_FAILED',
        message: err instanceof Error ? err.message : ERROR_LINE,
      });
    }
  }, []);

  function submitAnswer(answer: string) {
    dispatch({ type: 'ANSWER_SUBMITTED', answer });
    void judge(pitch, [...fight.answers, answer]);
  }

  function retry() {
    const answer = fight.answers[fight.answers.length - 1];
    dispatch({ type: 'RETRY' });
    if (answer) {
      dispatch({ type: 'ANSWER_SUBMITTED', answer });
      void judge(pitch, [...fight.answers.slice(0, -1), answer]);
    }
  }

  function toggleSound() {
    const next = !soundOn;
    setSoundEnabled(next);
    if (next) void playSfx('dodge');
  }

  function startRematch() {
    if (stored) setPitch(stored.pitch);
    dispatch({ type: 'RESET' });
    setEvaluation(null);
    setStartLine(null);
    setScreen('start');
  }

  function startFromScratch() {
    clearRound();
    setBaseline(null);
    setPitch('');
    setEvaluation(null);
    dispatch({ type: 'RESET' });
    setScreen('start');
  }

  // ---------- старт ----------

  if (screen === 'start') {
    return (
      <main className="start">
        <header className="start-head">
          <h1 className="title">ЗЛОЙ ИНВЕСТОР</h1>
          <p className="subtitle">Тренажёр защиты стартапа: 5 раундов, 3 совета</p>
        </header>

        <Stage phase="idle" round={1}>
          <div className="start-bubble">
            <SpeechBubble
              key={startLine ?? 'greeting'}
              text={startLine ?? START_GREETING}
              tone={startLine ? 'hit' : 'neutral'}
            />
          </div>
        </Stage>

        {stored ? (
          <section className="rematch-banner">
            <h2>Раунд {stored.round + 1}</h2>
            <p>Советы прошлого раунда. Отметь, что успел закрыть.</p>
            <AdviceChecklist advice={stored.advice} compact />
          </section>
        ) : null}

        <section className="start-form">
          <label className="sr-only" htmlFor="pitch">
            Текст питча
          </label>
          <textarea
            id="pitch"
            className="start-input"
            value={pitch}
            maxLength={MAX_PITCH}
            rows={7}
            placeholder="Проблема, решение, для кого, что уже сделано и какие цифры…"
            onChange={(e) => setPitch(e.target.value)}
          />
          <div className="start-row">
            <span className="start-count">
              {pitch.length}/{MAX_PITCH}
            </span>
            <button type="button" className="btn" onClick={() => setPitch(EXAMPLE)}>
              Вставить пример
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => void startFight()}
              disabled={pitch.trim().length === 0 || startBusy}
            >
              {startBusy ? 'Игорь читает…' : 'Выйти на ринг'}
            </button>
          </div>
          {stored ? (
            <button type="button" className="link-btn" onClick={startFromScratch}>
              Начать с нуля
            </button>
          ) : null}
          <p className="start-note">{PRIVACY_NOTE}</p>
        </section>
      </main>
    );
  }

  // ---------- итог ----------

  if (fight.phase === 'result') {
    if (!evaluation) {
      return (
        <main className="shell">
          <h1 className="title">Судьи считают очки…</h1>
        </main>
      );
    }

    return (
      <main className="result">
        <RankBadge total={evaluation.total_100} />

        <p className="result-parries">
          Отбито ударов: <b>{fight.parries}</b> из {TOTAL_ROUNDS}
        </p>

        {comparison ? (
          <ComparisonSummary
            comparison={comparison}
            criteria={evaluation.criteria}
            previous={baseline ? toCriteria(baseline) : []}
            total={evaluation.total_100}
          />
        ) : (
          <Radar criteria={evaluation.criteria} total={evaluation.total_100} />
        )}

        <SpeechBubble key="verdict" text={evaluation.verdict_line} />

        {evaluation.flags.manipulation_detected ? (
          <p className="result-flag">
            В тексте была просьба о высоком балле. На оценку она не повлияла.
          </p>
        ) : null}

        <AdviceChecklist advice={evaluation.advice} />

        <div className="result-row">
          <button type="button" className="btn btn--primary" onClick={startRematch}>
            Реванш
          </button>
          <StoryCardButton
            total={evaluation.total_100}
            criteria={evaluation.criteria}
            quote={evaluation.verdict_line}
          />
          <button
            type="button"
            className="btn"
            onClick={() =>
              download(
                new Blob([buildIcs(evaluation.advice)], { type: 'text/calendar;charset=utf-8' }),
                icsFileName(),
              )
            }
          >
            Добавить в календарь
          </button>
        </div>

        <h2 className="result-sub">Из чего сложился балл</h2>
        <ul className="result-criteria">
          {evaluation.criteria.map((c) => (
            <li key={c.id}>
              <div className="result-crit-head">
                <span>{c.name}</span>
                <b>
                  {c.score}/{c.max}
                </b>
              </div>
              {c.evidence ? (
                <p className="result-evidence">
                  «{c.evidence}» <span className="result-source">— {sourceLabel(c.source)}</span>
                </p>
              ) : (
                <p className="result-evidence result-evidence--none">Данных в питче и ответах нет</p>
              )}
            </li>
          ))}
        </ul>

        <details className="transcript">
          <summary>Транскрипт боя текстом</summary>
          <ol>
            {fight.answers.map((a, i) => (
              <li key={i}>
                <b>Раунд {i + 1}.</b> {a}
              </li>
            ))}
          </ol>
        </details>
      </main>
    );
  }

  // ---------- бой ----------

  const showQuestion = fight.phase === 'answering' || fight.phase === 'judging';
  const showReaction = fight.phase === 'parry' || fight.phase === 'hit';

  return (
    <main className="fight">
      <Stage phase={fight.phase} round={fight.round}>
        <Hud
          round={fight.round}
          stance={fight.stance}
          respect={fight.respect}
          soundOn={soundOn}
          onToggleSound={toggleSound}
        />

        {fight.phase === 'roundCard' ? <RoundBell round={fight.round} /> : null}

        {showReaction && fight.reaction ? (
          <div className="outcome">
            <span className={`outcome-tag outcome-tag--${fight.reaction.punch}`}>
              {fight.reaction.punch === 'parry' ? 'PARRY' : 'HIT'}
            </span>
            <SpeechBubble
              key={`r${fight.round}`}
              text={fight.reaction.line}
              tone={fight.reaction.punch}
              onTypingDone={() => {
                window.setTimeout(() => dispatch({ type: 'PHASE_DONE' }), REACTION_HOLD_MS);
              }}
            />
          </div>
        ) : null}

        {fight.error ? (
          <div className="fight-error" role="alert">
            <SpeechBubble key={fight.error} text={fight.error} tone="hit" />
            <button type="button" className="btn btn--primary" onClick={retry}>
              Повторить
            </button>
          </div>
        ) : null}

        {showQuestion && fight.question && !fight.error ? (
          <QuestionCard
            key={fight.question.round}
            question={fight.question}
            disabled={fight.waiting}
            onSubmit={submitAnswer}
          />
        ) : null}
      </Stage>

      <details className="transcript">
        <summary>Транскрипт боя текстом</summary>
        <ol>
          {fight.answers.map((a, i) => (
            <li key={i}>
              <b>Раунд {i + 1}.</b> {a}
            </li>
          ))}
        </ol>
      </details>
    </main>
  );
}

function sourceLabel(source: string): string {
  if (source === 'pitch') return 'из питча';
  const m = source.match(/^answer_([1-5])$/);
  return m ? `из ответа ${m[1]}` : 'без источника';
}

function toCriteria(stored: StoredRound) {
  return stored.criteria.map((c) => ({
    ...c,
    evidence: '',
    source: 'none',
    delta_from_answers: 0,
  }));
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Fight />
    </Suspense>
  );
}
