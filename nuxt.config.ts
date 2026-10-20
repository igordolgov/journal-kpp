// nuxt.config.ts
// Назначение: конфигурация Nuxt.
// prerender и routeRules отключены — они требуют appManifest, а он конфликтует
// с текущей версией Nuxt 4.5.2 (ошибка NUXT_E5001).
// Для Electron-сборки вернуть эти блоки после проверки на конкретной версии Nuxt.
//
// [ФИКС] Electron/file:// — три правки, проверены на реальном Electron 44 + loadFile:
//
// 1) experimental.payloadExtraction: false — отключает _payload.json.
//    Причина: fetch() на file:// в Chromium заблокирован (CORS, null origin),
//    фетчи payload-файлов под Electron всё равно падали и шумели в консоли.
//    Данные приложения и так грузятся из IndexedDB на клиенте.
//
// 2) vite.base: './' — относительные импорты ленивых чанков ВНУТРИ JS.
//    Без него переходы на /database, /reports и т.д. не грузят свои чанки.
//    На теги <script>/<link> в HTML он НЕ влияет — ими занимается п.3.
//
// 3) scripts/fix-electron-paths.mjs (в цепочке pnpm electron:build) —
//    переписывает "/_nuxt/..." → "./_nuxt/..." в HTML после nuxt generate.
//    Почему скриптом: app.baseURL и vite.base на HTML-теги не влияют —
//    Nuxt 4.6 нормализует пути обратно в "/" (ufo joinURL схлопывает "./"),
//    проверено пересборками. А "/_nuxt/..." под file:// резолвится в корень
//    диска → JS не исполняется, приложение остаётся «неживым» каркасом.
//
// app.baseURL: './' оставлен: относительный base полезен для head-ссылок
// (favicon) и не мешает; критичные части — п.2 и п.3.
//
// Нюанс: F5/перезагрузка окна на SPA-маршруте (/database и т.п.) под file://
// по-прежнему даст "файл не найден" (history-роутинг) — лекарство: кастомный
// протокол app:// в main.cjs (отдельная задача), пока просто не перезагружать.

import { defineNuxtConfig } from 'nuxt/config'
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  ssr: false,

  router: {
    options: {
      hashMode: true,
    },
  },

  devServer: {
    port: 3001
  },

  srcDir: 'app',

  future: {
    compatibilityVersion: 4,
  },

  app: {
    // Относительный base для head-ссылок (favicon) и роутера. На HTML-теги
    // ассетов не влияет (см. шапку, п.3) — критичные части: vite.base и fix-скрипт
    baseURL: './',

    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      title: 'Журнал КПП',
      meta: [
        { name: 'description', content: 'Система контроля пропускного пункта' },
        { name: 'robots', content: 'noindex, nofollow' },
      ],
      link: [
        // Относительные пути — абсолютные '/favicon...' под file:// не резолвятся
        { rel: 'icon', type: 'image/svg+xml', href: './favicon.svg' },
        { rel: 'icon', type: 'image/x-icon', href: './favicon.ico' },
      ],
    },
  },

  experimental: {
    // Отключает _payload.json: fetch на file:// заблокирован CORS
    payloadExtraction: false,
  },

  css: ['~/assets/css/main.css'],

  modules: ['@baptistecrouzet/nuxt-oxlint'],

  vite: {
    // Относительный base сборки Vite: делает ОТНОСИТЕЛЬНЫМИ импорты чанков
    // внутри JS ("./chunk.js" вместо "/ _nuxt/chunk.js") — без этого ленивые
    // страницы (БД, редактор...) не загрузятся под file://.
    // На теги в HTML vite.base НЕ влияет — их чинит fix-electron-paths.mjs.
    base: './',

    optimizeDeps: {
      include: [
        'fuse.js',
        'gsap',
      ],
      exclude: [
        '@vue/devtools-core',
        '@vue/devtools-kit',
      ],
    },
    plugins: [tailwindcss()],
  },

  devtools: { enabled: false },

  compatibilityDate: '2024-11-01',
})