// main.cjs
// Назначение: входная точка Electron — окно приложения + окружение portable.
// ПОЧЕМУ .cjs, А НЕ .js: в package.json стоит "type": "module", и Electron
// грузил бы main.js как ESM — в ESM нет require(), процесс падает на старте.
// Расширение .cjs принудительно включает CommonJS независимо от "type".
// [ФИКС] Данные (IndexedDB: журнал, база, сцены) привязаны к папке 'data'
// рядом с НАСТОЯЩИМ exe через PORTABLE_EXECUTABLE_DIR. Раньше Electron писал
// userData в %APPDATA% — поведение для portable ненадёжное (папка распаковки
// временная; на другой машине данные «терялись»).
// Бонус: перенос папки с exe переносит и данные — истинная портативность.

const { app, BrowserWindow, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

// ===== Данные рядом с exe (portable-режим) =====
// Переменную PORTABLE_EXECUTABLE_DIR задаёт portable-загрузчик electron-builder.
// setPath вызывается ДО whenReady — это обязательный порядок.
if (process.env.PORTABLE_EXECUTABLE_DIR) {
  const dataDir = path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'data')
  try {
    // Electron создаёт userData-каталог сам, но явное создание страхует
    // от гонок при первом запуске с недоступным диском
    fs.mkdirSync(dataDir, { recursive: true })
  } catch (e) {
    // Каталог не создался (нет прав/диск read-only) — Electron молча
    // откатится на дефолтный %APPDATA%, приложение продолжит работать
    console.error('[main] Не удалось создать каталог данных:', e)
  }
  app.setPath('userData', dataDir)
}

// Главная страница SPA-сборки Nuxt (ssr:false кладёт её в .output/public)
const indexPath = path.join(__dirname, '.output', 'public', 'index.html')

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    // Меню Electron (File/Edit/View) скрыто; Alt — показать при необходимости
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  win.loadFile(indexPath)

  // Открываем DevTools только для отладки белого экрана (можно удалить)
  // win.webContents.openDevTools()
}

app.whenReady().then(() => {
  // Страховка: electron:build запущен БЕЗ предварительного pnpm build —
  // тогда .output/public/index.html не существует и окно было бы белым.
  if (!fs.existsSync(indexPath)) {
    dialog.showErrorBox(
      'Нет сборки Nuxt',
      'Не найден файл:\n' + indexPath +
      '\n\nСначала выполните:\n    pnpm build\nзатем:\n    pnpm electron:build'
    )
    app.quit()
    return
  }
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
