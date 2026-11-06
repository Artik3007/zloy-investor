import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Чистые функции в tests/ плюс прогон датасета из scripts/.
    include: ['tests/**/*.test.ts', 'scripts/run-fixtures.ts'],
    environment: 'node',
  },
});
