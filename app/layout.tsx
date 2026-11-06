import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Злой инвестор — тренажёр защиты стартапа',
  description:
    'Пять раундов на ринге с бизнес-ангелом Игорем: 5 вопросов по твоему питчу, оценка по 10 критериям и 3 совета до выхода на сцену.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Сцена боя фиксированной пропорции; масштабирование оставляем доступным (a11y).
  maximumScale: 5,
  themeColor: '#0a0e1a',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
