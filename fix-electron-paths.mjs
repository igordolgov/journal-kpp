// scripts/fix-electron-paths.mjs
// Назначение: после `nuxt generate` переписывает абсолютные пути ассетов
// (/_nuxt/..., /_payload.json) на ОТНОСИТЕЛЬНЫЕ во всех HTML-файлах
// .output/public — с учётом глубины вложенности каждого файла.
//
// Зачем: Electron грузит index.html через win.loadFile() (протокол file://).
// Абсолютный путь "/_nuxt/entry.js" резолвится как file:///_nuxt/entry.js —
// корень диска, файла там нет → скрипты/стили не грузятся, приложение
// работает только как «неживой» пререндер-каркас, клики по ссылкам валятся
// в ERR_FILE_NOT_FOUND.
//
// Почему нельзя настроить в Nuxt: в Nuxt 4.6 + Vite 8 app.baseURL и
// vite.base при сборке нормализуются обратно в '/' (ufo joinURL схлопывает
// './'), проверено на практике. Пост-обработка — детерминированный способ,
// не зависящий от версии Nuxt.
//
// Запуск: node scripts/fix-electron-paths.mjs
// Включён в цепочку: pnpm electron:build (см. package.json).
// Скрипт идемпотентный: './_nuxt/' не содержит '/_nuxt/',
// повторный запуск ничего не меняет.

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = '.output/public'

// Рекурсивно собираем все *.html в .output/public
const collectHtml = (dir) => {
  const files = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) files.push(...collectHtml(full))
    else if (name.endsWith('.html')) files.push(full)
  }
  return files
}

const htmlFiles = collectHtml(ROOT)
let changed = 0

for (const file of htmlFiles) {
  const rel = relative(ROOT, file)
  // Глубина файла относительно корня: index.html → './', database/index.html → '../'
  const depth = rel.split(/[\\/]/).length - 1
  const prefix = depth === 0 ? './' : '../'.repeat(depth)

  let html = readFileSync(file, 'utf8')
  const fixed = html
    // Пререндеренные ссылки на payload (если payloadExtraction снова включат)
    .replaceAll('/_payload.json', `${prefix}_payload.json`)
    // Ассеты Vite: скрипты, CSS, modulepreload-ссылки, importmap
    .replaceAll('/_nuxt/', `${prefix}_nuxt/`)

  if (fixed !== html) {
    writeFileSync(file, fixed)
    changed++
    console.log(`[fix-paths] ${rel}: пути → ${prefix}_nuxt/`)
  } else {
    console.log(`[fix-paths] ${rel}: без изменений`)
  }
}

console.log(`[fix-paths] Готово. Изменено файлов: ${changed} из ${htmlFiles.length}.`)
