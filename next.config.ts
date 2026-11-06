import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV === 'development';

/**
 * CSP без `unsafe-eval` (требование раздела 7.6 ТЗ).
 * В dev-режиме Turbopack-HMR требует `unsafe-eval`, поэтому он добавляется
 * только при NODE_ENV=development и никогда не попадает в прод-сборку.
 * `unsafe-inline` для script-src нужен App Router для inline-флайт-данных
 * (альтернатива — nonce через proxy, для прототипа не нужна).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // Питч уходит только на наш сервер, тот — к LLM-провайдеру. Клиент к провайдеру не ходит.
  `connect-src 'self'${isDev ? ' ws: wss:' : ''}`,
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

const nextConfig: NextConfig = {
  headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
        ],
      },
    ];
  },
  // Оргкомитет смотрит открытый репозиторий: лишних заголовков о стеке не отдаём.
  poweredByHeader: false,
};

export default nextConfig;
