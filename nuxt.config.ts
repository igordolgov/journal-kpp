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

  future: {
    compatibilityVersion: 4,
  },

  app: {
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