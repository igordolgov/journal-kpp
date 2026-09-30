// nuxt.config.ts
// Назначение: конфигурация Nuxt.
// [ОЧИСТКА] Удалён блок PWA (@vite-pwa/nuxt, manifest, workbox) — приложение
// доставляется как Electron-exe, браузерная установка не используется.
// [ОЧИСТКА] Удалены meta apple-mobile-web-app-* и theme-color (PWA-хвосты),
// из viewport убран maximum-scale=1 — пользователь снова может зумить (a11y).
// prerender ОСТАВЛЕН: exe загружает именно статические страницы из
// .output/public — это фундамент Electron-сборки, а не PWA.

import { defineNuxtConfig } from 'nuxt/config'
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  // Базовые настройки
  devServer: {
    port: 3001
  },

  srcDir: 'app',

  future: {
    compatibilityVersion: 4,
  },

  app: {
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
        // fallback для контекстов без поддержки SVG
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      ],
    },
  },

  css: ['~/assets/css/main.css'],

  modules: [],

  vite: {
    optimizeDeps: {
      include: [
        '@vue/devtools-core',
        '@vue/devtools-kit',
        'fuse.js',
        'gsap',
      ],
    },
    plugins: [tailwindcss()],
  },

  nitro: {
    prerender: {
      routes: ['/', '/editor', '/database', '/settings', '/reports'],
    },
    routeRules: {
      '/': { ssr: true }
    }
  },

  devtools: { enabled: false },

  compatibilityDate: '2024-11-01',
})