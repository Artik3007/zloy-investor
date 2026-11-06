'use client';

/** Крупный QR для слайда на защите. */

import { useEffect, useState } from 'react';
import { appUrl, makeQrDataUrl, shortHost } from '@/lib/qr';

export default function QrPage() {
  const [state, setState] = useState<{ src: string | null; url: string }>({
    src: null,
    url: '',
  });

  useEffect(() => {
    const target = appUrl();
    if (!target) return;
    let alive = true;
    // setState только в колбэке промиса: синхронного вызова в эффекте нет.
    void makeQrDataUrl(target, 900)
      .then((src) => {
        if (alive) setState({ src, url: target });
      })
      .catch(() => {
        if (alive) setState({ src: null, url: target });
      });
    return () => {
      alive = false;
    };
  }, []);

  const { src, url } = state;

  return (
    <main className="qr-page">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="qr-img" src={src} alt={`QR-код на ${shortHost(url)}`} />
      ) : (
        <div className="qr-img qr-img--empty" />
      )}
      <h1 className="qr-title">Прожарь свой стартап</h1>
      <p className="qr-url">{shortHost(url)}</p>
    </main>
  );
}
