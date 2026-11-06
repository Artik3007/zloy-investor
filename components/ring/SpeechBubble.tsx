'use client';

/**
 * Реплика Игоря с эффектом печати. По клику показывается целиком.
 * Текст модели выводится только как текст, без dangerouslySetInnerHTML.
 * Сброс при смене реплики делается через key на компоненте.
 */

import { useEffect, useRef, useState } from 'react';
import { TYPE_MS_PER_CHAR } from '@/lib/fight/timeline';
import { useReducedMotion } from './use-reduced-motion';

type Props = {
  text: string;
  /** Исход удара красит рамку пузыря. */
  tone?: 'neutral' | 'parry' | 'hit';
  onTypingDone?: () => void;
};

export default function SpeechBubble({ text, tone = 'neutral', onTypingDone }: Props) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(0);
  const notified = useRef(false);

  const visible = reduced ? text.length : Math.min(shown, text.length);
  const done = visible >= text.length;

  useEffect(() => {
    if (reduced || text.length === 0) return;
    const timer = window.setInterval(() => {
      setShown((prev) => {
        if (prev >= text.length) {
          window.clearInterval(timer);
          return prev;
        }
        return prev + 1;
      });
    }, TYPE_MS_PER_CHAR);
    return () => window.clearInterval(timer);
  }, [reduced, text]);

  useEffect(() => {
    if (!done || notified.current) return;
    notified.current = true;
    onTypingDone?.();
  }, [done, onTypingDone]);

  return (
    <div
      className={`bubble bubble--${tone}`}
      onClick={() => setShown(text.length)}
      aria-live="polite"
    >
      <span className="bubble-name">Игорь</span>
      <p className="bubble-text">{text.slice(0, visible)}</p>
    </div>
  );
}
