/** QR на клиенте. Общая точка для карточки сторис и страницы /qr. */

import QRCode from 'qrcode';

const OPTIONS = {
  errorCorrectionLevel: 'M' as const,
  margin: 4,
  color: { dark: '#000000ff', light: '#ffffffff' },
};

export async function makeQrDataUrl(url: string, width = 512): Promise<string> {
  return QRCode.toDataURL(url, { ...OPTIONS, width });
}

export async function drawQr(canvas: HTMLCanvasElement, url: string, width = 512): Promise<void> {
  await QRCode.toCanvas(canvas, url, { ...OPTIONS, width });
}

/** Приоритет: переменная окружения, иначе текущий адрес. */
export function appUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured;
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

export function shortHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  }
}
