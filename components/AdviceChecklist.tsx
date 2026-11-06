'use client';

/** Три совета как чек-лист. Отметки живут в localStorage. */

import { useState } from 'react';
import type { Advice } from '@/lib/schemas';
import { setAdviceDone } from '@/lib/round-store';

type Props = {
  advice: Advice[];
  /** В баннере реванша чек-лист компактный. */
  compact?: boolean;
};

export default function AdviceChecklist({ advice, compact = false }: Props) {
  const [checked, setChecked] = useState<boolean[]>(() => advice.map((a) => a.done));
  const doneCount = checked.filter(Boolean).length;

  function toggle(index: number) {
    setChecked((prev) => {
      const next = prev.map((v, i) => (i === index ? !v : v));
      setAdviceDone(index, next[index] ?? false);
      return next;
    });
  }

  return (
    <section className={compact ? 'advice advice--compact' : 'advice'}>
      <header className="advice-head">
        <h3>Три шага до защиты</h3>
        <span className="advice-count">
          Выполнено {doneCount}/{advice.length}
        </span>
      </header>

      <ul className="advice-list">
        {advice.map((item, i) => (
          <li key={item.action} className={checked[i] ? 'advice-item advice-item--done' : 'advice-item'}>
            <label className="advice-label">
              <input
                type="checkbox"
                checked={checked[i] ?? false}
                onChange={() => toggle(i)}
              />
              <span className="advice-action">{item.action}</span>
            </label>
            <p className="advice-meta">
              до {item.deadline_days} дн. · готово, когда: {item.done_when}
            </p>
            {item.why ? (
              <details className="advice-why">
                <summary>Зачем это</summary>
                <p>{item.why}</p>
              </details>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
