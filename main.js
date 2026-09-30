// main.js
// Назначение: входная точка Electron — окно приложения + окружение portable.
// [ФИКС] Данные (IndexedDB: журнал, база, сцены) привязаны к папке 'data'
// рядом с НАСТОЯЩИМ exe через PORTABLE_EXECUTABLE_DIR. Раньше Electron писал
// userData в %APPDATA% — поведение для portable ненадёжное (папка распаковки
// временная; на другой машине данные «терялись»).
// Бонус: перенос папки с exe переносит и данные — истинная портативность.

const { app, BrowserWindow } = require('electron')
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

  // Загружаем статический index.html из папки .output/public
  // (пререндерNitro — фундамент сборки, работает без сервера)
  win.loadFile(path.join(__dirname, '.output', 'public', 'index.html'))

  // Открываем DevTools только для отладки (можно удалить)
  // win.webContents.openDevTools()
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})