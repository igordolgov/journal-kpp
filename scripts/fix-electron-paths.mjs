// scripts/fix-electron-paths.mjs
// Назначение: после nuxt generate заменяет в .output/public/*.html абсолютные
// пути на относительные. exe грузит index.html через file://, где абсолютный
// путь "/_nuxt/..." указывает в корень ДИСКА и даёт белый экран.
// Почему скрипт, если baseURL './' уже относительный: двойная страховка —
// даже если base слетит в конфиге или Nuxt сгенерирует абсолютные ссылки в
// modulepreload/manifest, сборка останется работоспособной. Если пути уже
// относительные, замены равны нулю и файлы не перезаписываются.
// Идемпотентен: можно запускать многократно.
// Запуск: node scripts/fix-electron-paths.mjs (из корня проекта)

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const PUBLIC_DIR = join(process.cwd(), '.output', 'public')

// Кавычки в шаблонах обязательны: меняем только целиком закавыченные значения
// атрибутов и строк, чтобы не задеть чужие пути вида "/_nuxt-extra/..."
const REPLACEMENTS = [
  ['"/_nuxt/', '"./_nuxt/'],
  ['"/favicon.svg"', '"./favicon.svg"'],
  ['"/favicon.ico"', '"./favicon.ico"'],
]

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      yield* walk(full)
    } else if (name.endsWith('.html')) {
      yield full
    }
  }
}

if (!existsSync(join(PUBLIC_DIR, 'index.html'))) {
  console.error(
    '[fix-electron-paths] Не найден ' + join(PUBLIC_DIR, 'index.html') +
    ' — сначала выполните сборку фронта: pnpm build',
  )
  process.exit(1)
}

let checked = 0
let changed = 0
for (const file of walk(PUBLIC_DIR)) {
  checked++
  const original = readFileSync(file, 'utf8')
  let text = original
  const applied = []
  for (const [from, to] of REPLACEMENTS) {
    const count = text.split(from).length - 1
    if (count > 0) {
      text = text.split(from).join(to)
      applied.push(from + ' → ' + to + ' (' + count + ')')
    }
  }
  if (text !== original) {
    writeFileSync(file, text, 'utf8')
    changed++
    console.log('[fix-electron-paths] ' + file + ': ' + applied.join(', '))
  }
}
console.log(
  '[fix-electron-paths] Проверено HTML: ' + checked +
  ', изменено: ' + changed + '. Пути относительные — file:// не сломается.',
)
