'use client';

/**
 * Спрайт показываем, только когда файл реально загрузился. Пока ассетов нет
 * (или они ещё едут), рисуется SVG-заглушка.
 *
 * onError на <img> здесь не годится: при серверном рендере картинка успевает
 * упасть до гидрации, и обработчик уже не вызовется.
 */

import { useEffect, useState } from 'react';

const cache = new Map<string, boolean>();

export function useSprite(src: string | undefined): boolean {
  const [ready, setReady] = useState(() => (src ? cache.get(src) === true : false));

  useEffect(() => {
    if (!src || cache.has(src)) return;

    const img = new Image();
    img.onload = () => {
      cache.set(src, true);
      setReady(true);
    };
    img.onerror = () => {
      cache.set(src, false);
    };
    img.src = src;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return ready;
}
