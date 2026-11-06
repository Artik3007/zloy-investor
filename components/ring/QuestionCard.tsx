'use client';

/**
 * Карточка вопроса и ввод ответа. На мобильных — bottom sheet, который
 * учитывает экранную клавиатуру через visualViewport (раздел 9.7 ТЗ).
 */

import { useEffect, useRef, useState } from 'react';
import { MAX_ANSWER } from '@/lib/schemas';
import type { QuestionPayload } from '@/lib/schemas';
import { ANSWER_TIMER_S, ANSWER_TIMER_WARN_S, roundSpec } from '@/lib/fight/timeline';

type Props = {
  question: QuestionPayload;
  disabled: boolean;
  onSubmit: (answer: string) => void;
};

const RADIUS = 20;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function QuestionCard({ question, disabled, onSubmit }: Props) {
  const [value, setValue] = useState('');
  const [left, setLeft] = useState(ANSWER_TIMER_S);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  // Таймер чисто визуальный: по нулю ничего не происходит, бой ждёт.
  // Сброс между раундами — через key на компоненте, не через setState в эффекте.
  useEffect(() => {
    const timer = window.setInterval(() => {
      setLeft((prev) => (prev <= 0 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Клавиатура на телефоне не должна перекрывать поле ответа.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const sync = () => {
      const overlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty('--kb', `${Math.round(overlap)}px`);
    };
    sync();
    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    return () => {
      vv.removeEventListener('resize', sync);
      vv.removeEventListener('scroll', sync);
      document.documentElement.style.setProperty('--kb', '0px');
    };
  }, []);

  const trimmed = value.trim();
  const canSend = trimmed.length > 0 && !disabled;
  const spec = roundSpec(question.round);
  const warn = left <= ANSWER_TIMER_WARN_S;
  const offset = CIRCUMFERENCE * (1 - left / ANSWER_TIMER_S);

  function send() {
    if (!canSend) return;
    onSubmit(trimmed.slice(0, MAX_ANSWER));
    setValue('');
  }

  return (
    <section className="qcard" aria-label={`Вопрос раунда ${question.round}`}>
      <header className="qcard-head">
        <span className="qcard-meta">
          Раунд {question.round} · {spec.punchName}
        </span>

        <div className={warn ? 'timer timer--warn' : 'timer'} aria-hidden="true">
          <svg viewBox="0 0 48 48">
            <circle className="timer-track" cx="24" cy="24" r={RADIUS} />
            <circle
              className="timer-run"
              cx="24"
              cy="24"
              r={RADIUS}
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
            />
          </svg>
          <span className="timer-num">{left > 0 ? left : '•'}</span>
        </div>
      </header>

      <p className="qcard-question" aria-live="polite">
        {question.text}
      </p>

      {left === 0 ? <p className="qcard-gong">Гонг, но я подожду.</p> : null}

      <label className="sr-only" htmlFor="answer">
        Твой ответ
      </label>
      <textarea
        id="answer"
        ref={areaRef}
        className="qcard-input"
        value={value}
        maxLength={MAX_ANSWER}
        rows={2}
        disabled={disabled}
        placeholder="Коротко и по делу…"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            send();
          }
        }}
      />

      <footer className="qcard-foot">
        <span className="qcard-hint">Коротко и с цифрами. Игорь любит конкретику.</span>
        <span className="qcard-count">
          {value.length}/{MAX_ANSWER}
        </span>
        <button type="button" className="btn btn--primary" onClick={send} disabled={!canSend}>
          {disabled ? 'Игорь думает…' : 'Ответить'}
        </button>
      </footer>
    </section>
  );
}
