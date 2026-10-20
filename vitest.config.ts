// vitest.config.ts
// Назначение: конфигурация юнит-тестов логики симулятора (Vitest).
// Тестируем чистую логику (спавн, физика, утилиты) без Nuxt-рантайма:
// алиасы ~/ и @ ведут на app/, аудио-движок и интеграцию с БД подменяем
// заглушками через алиасы (конкретные пути перекрывают общий '~/').

import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      // Сначала конкретные заглушки, потом общий алиас '~'
      '~/composables/useAudioEngine': r('./tests/stubs/useAudioEngine.ts'),
      '~/composables/useSimulatorIntegration': r('./tests/stubs/useSimulatorIntegration.ts'),
      '~': r('./app'),
      '@': r('./app'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
