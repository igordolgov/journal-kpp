// nuxt.config.ts
// Назначение: конфигурация Nuxt.
// prerender и routeRules отключены — они требуют appManifest, а он конфликтует
// с текущей версией Nuxt 4.5.2 (ошибка NUXT_E5001).
// Для Electron-сборки вернуть эти блоки после проверки на конкретной версии Nuxt.

import { defineNuxtConfig } from 'nuxt/config'
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  devServer: {
    port: 3001
  },

  srcDir: 'app',

  // [ELECTRON] exe-сборка: SPA без сервера; хеш-роутинг обязателен для file://
  // (history-пути на file:// дают 404 «Page not found» — nuxt#15629).
  ssr: false,
  router: {
    options: {
      hashMode: true,
    },
  },

  future: {
    compatibilityVersion: 4,
  },

  app: {
    // [ELECTRON] base "/" — ОБЯЗАТЕЛЕН: при относительном "./" nitro-server 4.6.3+
    // не находит обработчик для prerender-запроса "/" (404), и в index.html /
    // 200.html / 404.html записывается 16-байтовая заглушка "Redirecting..." —
    // exe показывает только её (поставка №38). file://-совместимость это не ломает:
    // чанки ссылаются друг на друга относительно, а абсолютные ссылки в HTML
    // переводит в относительные scripts/fix-electron-paths.mjs после generate.
    baseURL: '/',

    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      title: 'Журнал КПП',
      meta: [
        { name: 'description', content: 'Система контроля пропускного пункта' },
        { name: 'robots', content: 'noindex, nofollow' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      ],
    },
  },

  css: ['~/assets/css/main.css'],

  modules: [],

  vite: {
    optimizeDeps: {
      include: [
        '@lucide/vue',
        'chart.js',
        'fuse.js',
        'gsap',
        'nanoid',
        'vue-chartjs',
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