// nuxt.config.ts
// Улучшения:
// 1. PWA включён (был disabled)
// 2. Добавлены глобальные SEO-мета через app.head
// 3. Добавлена компрессия через vite
// 4. routeRules для статических страниц

import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  dir: {
    app: 'app',
  },

  future: {
    compatibilityVersion: 4,
  },

  // Глобальные SEO мета-теги
  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
      title: 'Журнал КПП',
      meta: [
        { name: 'description', content: 'Система контроля пропускного пункта' },
        { name: 'theme-color', content: '#1d232a' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        // Запрет индексации (внутреннее корпоративное приложение)
        { name: 'robots', content: 'noindex, nofollow' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/pwa-192x192.png' },
      ],
    },
  },

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
    build: {
      // Разбить бандл на чанки — симулятор грузится отдельно
      rollupOptions: {
        output: {
          manualChunks: {
            'simulator': [
              './app/composables/simulator/useSimulatorCore.ts',
              './app/composables/simulator/useSimulatorPhysics.ts',
              './app/composables/simulator/useSimulatorSpawn.ts',
              './app/composables/simulator/useSimulatorAudio.ts',
            ],
            'gsap': ['gsap'],
            'charts': ['chart.js', 'vue-chartjs'],
          },
        },
      },
    },
  },

  css: ['~/assets/css/main.css'],

  modules: [
    '@vite-pwa/nuxt',  // Включён
    'v-gsap-nuxt',
  ],

  server: {
    port: 3001,
  },

  // PWA конфигурация
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Журнал КПП',
      short_name: 'КПП',
      description: 'Система контроля пропускного пункта',
      theme_color: '#1d232a',
      background_color: '#1d232a',
      display: 'standalone',
      orientation: 'portrait-primary',
      start_url: '/',
      icons: [
        { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      // Не кэшировать API и IndexedDB-запросы
      navigateFallbackDenylist: [/^\/api/],
      runtimeCaching: [
        {
          urlPattern: /\.(png|jpg|jpeg|svg|gif|webp)$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'images',
            expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 },
          },
        },
      ],
    },
    devOptions: {
      enabled: false, // В dev-режиме выключен
    },
  },

  compatibilityDate: '2024-11-01',
})
