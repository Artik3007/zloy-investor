import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'out/**', 'build/**', '.vercel/**', 'next-env.d.ts']),
  {
    // Спрайты ринга: нужен onError → SVG-заглушка, пока ассетов нет,
    // и мгновенная смена позы без слоя оптимизатора. next/image здесь мешает.
    files: ['components/ring/Fighter.tsx', 'components/ring/FistPov.tsx'],
    rules: { '@next/next/no-img-element': 'off' },
  },
  {
    rules: {
      // Раздел 3 ТЗ: текст модели выводится только как текст.
      // Без плагина react: правило ядра точечно бьёт по самому атрибуту.
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'dangerouslySetInnerHTML запрещён: текст модели выводится только как текст.',
        },
      ],
      // Раздел 3 ТЗ: импорты только в начале файла.
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
]);

export default eslintConfig;
