'use client';

/** Карточка для сторис: PNG 1080×1920, всё на устройстве. */

import { useEffect, useState } from 'react';
import { getRank } from '@/lib/rank';
import { appUrl } from '@/lib/qr';
import { renderStoryCard } from '@/lib/story-card';
import type { CriterionResult } from '@/lib/schemas';

type Props = {
  total: number;
  criteria: CriterionResult[];
  quote: string;
};

export default function StoryCardButton({ total, criteria, quote }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  async function build() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await renderStoryCard({ total, criteria, quote, appUrl: appUrl() });
      const file = new File([blob], fileName(), { type: 'image/png' });
      setCanShare(
        typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] }),
      );
      setUrl(URL.createObjectURL(blob));
    } catch {
      setError('Карточка не нарисовалась. Попробуй ещё раз.');
    } finally {
      setBusy(false);
    }
  }

  function fileName(): string {
    return `zloy-investor-${getRank(total).id}.png`;
  }

  async function share() {
    if (!url) return;
    try {
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], fileName(), { type: 'image/png' });
      await navigator.share({ files: [file] });
    } catch {
      // Отмена шаринга — не ошибка.
    }
  }

  return (
    <>
      <button type="button" className="btn" onClick={() => void build()} disabled={busy}>
        {busy ? 'Рисую…' : 'Карточка для сторис'}
      </button>

      {url ? (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Карточка для сторис">
          <div className="modal-box">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="modal-img" src={url} alt="Карточка с рангом, баллом и радаром" />
            <p className="modal-hint">
              Карточка создаётся у тебя на устройстве. Мы её нигде не сохраняем и не публикуем.
            </p>
            <p className="modal-hint">Нажми и удерживай картинку, чтобы сохранить.</p>
            <div className="modal-row">
              <a className="btn btn--primary" href={url} download={fileName()}>
                Скачать
              </a>
              {canShare ? (
                <button type="button" className="btn" onClick={() => void share()}>
                  Поделиться
                </button>
              ) : null}
              <button
                type="button"
                className="btn"
                onClick={() => {
                  URL.revokeObjectURL(url);
                  setUrl(null);
                }}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}
    </>
  );
}
