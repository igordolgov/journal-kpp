// nuxt.config.ts
// Файл конфигурации Nuxt приложения.
// Определяет настройки сборки, модули (PWA, GSAP), Tailwind 4 и структуру папок.

import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  // Настройка директорий для Nuxt 4
  dir: {
    app: 'app'
  },

  // Включение режима совместимости с Nuxt 4
  future: {
    compatibilityVersion: 4
  },

  // Настройки Vite
  // Подключение плагина Tailwind CSS v4
  vite: {
    optimizeDeps: {
      include: [
        '@vue/devtools-core',
        '@vue/devtools-kit',
        'fuse.js',
        'gsap',
      ]
    },
    plugins: [tailwindcss()]
  },

  // Глобальные CSS файлы
  css: ['~/assets/css/main.css'],

  // Подключенные модули Nuxt
  modules: [
    // '@vite-pwa/nuxt', // Модуль для Progressive Web App
    'v-gsap-nuxt'     // Модуль для GSAP анимаций
  ],

  server: { 
    port: 3001 
  },

  // Настройки PWA
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Журнал КПП',
      short_name: 'КПП',
      theme_color: '#1d232a', // Цвет темы из DaisyUI (dark)
      background_color: '#1d232a',
      display: 'standalone',
      icons: [
        { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' }
      ]
    },
    workbox: {
      globDirectory: false, // Отключаем авто-сканирование (настройка под конкретные нужды)
      globPatterns: [
        '**/*.{js,css,html,ico,png,svg,woff2}',
      ]
    },
    enabled: false,  // PWA полностью выключен в dev-режиме
  },

  compatibilityDate: '2024-11-01'
})