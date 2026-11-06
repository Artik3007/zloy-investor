<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Правила этого проекта

Полное ТЗ — в задаче на проект; ТЗ фишек 3–5 — в `docs/features-3-4-5.md`;
датасет из 15 заявок — в `docs/pitch-dataset.md`.

### Что важно помнить про этот Next.js (16.4)
- Turbopack — бандлер по умолчанию. Webpack только через `--webpack`.
- `next lint` удалён. Линт — скрипт `npm run lint` (`eslint .`), flat-config в `eslint.config.mjs`.
- `next build` больше не запускает линтер сам.
- Конфиг — `next.config.ts`, типизируется `NextConfig`.
- API — Route Handlers (`app/api/*/route.ts`) на Web `Request`/`Response`.

### Жёсткие правила кода
- Tailwind не используем. Стили — `app/globals.css` (+ CSS-модули рядом с компонентами).
- TypeScript strict. В `switch` по union/enum в `default` — проверка `never`.
- Импорты только в начале файла, без inline-импортов.
- Текст модели выводится **только как текст**. `dangerouslySetInnerHTML` запрещён.
- Логика оценки, веса, пороги рангов и промпты живут только в `lib/server/*`
  и не попадают в клиентский бандл.
- Зависимости: `zod` и `qrcode` (+`@types/qrcode`, фишка 4). SDK провайдеров LLM не ставим — только `fetch`.
- Ключ LLM только на сервере, в логи не пишем. Логи — без текста питча и ответов.
- Язык интерфейса и инвестора — русский, обращение на «ты».

### Проверки после каждой фазы
```
npx tsc --noEmit && npm run lint && npm run build
```
