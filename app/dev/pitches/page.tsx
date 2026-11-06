'use client';

/** Список тестовых питчей для быстрого прогона. Только при NEXT_PUBLIC_DEV_TOOLS=1. */

import { useRouter } from 'next/navigation';
import pitches from '@/data/pitches.json';
import { DEV_PITCH_KEY } from '@/lib/copy';

export default function DevPitchesPage() {
  const router = useRouter();

  if (process.env.NEXT_PUBLIC_DEV_TOOLS !== '1') {
    return (
      <main className="shell">
        <h1 className="title">Недоступно</h1>
        <p className="subtitle">Страница включается переменной NEXT_PUBLIC_DEV_TOOLS=1.</p>
      </main>
    );
  }

  function load(text: string) {
    try {
      window.sessionStorage.setItem(DEV_PITCH_KEY, text);
    } catch {
      // Без storage просто не предзаполнится.
    }
    router.push('/');
  }

  return (
    <main className="shell">
      <h1 className="title">Тестовые питчи</h1>
      <p className="subtitle">15 заявок из датасета. Кнопка загружает питч в бой.</p>
      <ul className="dev-list">
        {pitches.map((p) => (
          <li key={p.id}>
            <div>
              <b>
                {p.id} · {p.title}
              </b>
              <p className="dev-text">{p.text.slice(0, 160)}…</p>
            </div>
            <button type="button" className="btn" onClick={() => load(p.text)}>
              Загрузить в бой
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
