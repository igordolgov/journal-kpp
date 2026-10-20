# Журнал КПП

Симулятор пропускного пункта с электронным журналом: пешеходы и машины,
калитка и шлагбаум, смены, записи въезда/выезда, поощрения и штрафы.
Electron-приложение на Nuxt 4 — работает как офлайн-десктоп (portable exe)
и как веб-приложение в dev-режиме.

    ⚠️ Учебный проект. Люди, автомобили и события генерируются симулятором
    и вымышлены. Не использовать как реальный журнал КПП или средство
    контроля доступа.

## Стек

- Фреймворк: Nuxt 4.6 + Vue 3.5 (`ssr: false`, hash-роутинг, `baseURL: './'` — под Electron)
- Роутинг: файловый роутинг Nuxt (Vue Router 5)
- Стили: TailwindCSS 4 + daisyUI 5
- Шаблоны: Pug (`@vue/language-plugin-pug`)
- Анимация: GSAP 3 (шлагбаум, калитка)
- Графики: Chart.js 4 + vue-chartjs (отчёты)
- Поиск: Fuse.js (нечёткий поиск по журналу/людям)
- Хранилище: IndexedDB (БД v11, 7 сторов: `people`, `vehicles`, `journal`, `settings`, `shifts`, `scenes`, `payroll`) — см. `app/composables/useDatabase.ts`
- Десктоп: Electron 44 + electron-builder 26 (портативный exe)
- Тесты: vitest 4 + happy-dom
- Язык: TypeScript 5.9
- Пакетный менеджер: pnpm

## Требования

- Node.js: 22.x или 24.x (LTS)
- pnpm: 10 или новее
- ОС: Windows 10/11 (сборка exe), Linux, macOS (разработка)

## Установка

```bash
git clone https://github.com/igordolgov/journal-kpp.git
cd journal-kpp
pnpm install
```

Если pnpm блокирует postinstall-скрипты (обычно на Windows) — в проекте
уже прописан блок `allowScripts` (esbuild, @parcel/watcher, electron-winstaller).
Если pnpm всё же спрашивает разрешение:

```bash
pnpm approve-builds
```

Выбрать все пакеты (a + Enter), затем:

```bash
pnpm rebuild
```

## Разработка

```bash
pnpm dev
```

Открыть: http://localhost:3001/ (порт задан в `nuxt.config.ts`).

    ⚠️ В dev-режиме приложение живёт в браузере: данные пишутся в IndexedDB
    этого браузера (F12 → Application → IndexedDB). У portable exe — своё
    хранилище (userData Electron). Данные dev и exe не смешиваются и
    автоматически не переносятся: то, что наработал симулятор в браузере,
    exe не увидит, и наоборот.

## Тесты

```bash
pnpm test               # разовый прогон (vitest, ожидается 36 passed)
pnpm test:watch         # режим слежения
npx vue-tsc --noEmit    # проверка типов (отдельного скрипта нет)
```

Физика симулятора тестируется чистой функцией `updateAiMovement(dt, cfg)`
без DOM и без Vue: в тестах собирается харнесс со сценой-заглушкой
(калитка, агенты) и прогоняются кадры с фиксированным `dt = 0.1`.

## Сборка Electron (portable exe)

```bash
pnpm generate                          # статическая сборка в .output/public
node scripts/fix-electron-paths.mjs    # абсолютные пути → относительные
pnpm electron:build                    # electron-builder --win portable
```

Результат: `dist-electron/JournalKPP.exe` — портативный, без установки.

⚠️ Почему три команды, а не одна: exe грузит `index.html` через `file://`,
где абсолютный путь `/_nuxt/...` указывает в корень диска и даёт белый
экран. Страховка тройная: `ssr: false` + `router.options.hashMode` +
`app.baseURL: './'` в конфиге, плюс скрипт `fix-electron-paths.mjs`
переписывает пути в готовом HTML (идемпотентен — можно запускать
многократно; если пути уже относительные, файлы не перезаписываются).

⚠️ Правило сборки (проверено болезненно)

1. Ctrl+S всем изменённым файлам; контроль ключевой строки: `rg "маркер" файл`
2. Порядок строгий: `pnpm generate` → `fix-electron-paths` → `pnpm electron:build`.
   Пропущенный `generate` = exe со старым интерфейсом (собирается из
   `.output/public`, а не из исходников).
3. Дочитывать вывод каждой команды до конца (`electron:build` — до
   `building target=portable`).
4. После сборки запустить exe и проверить: принятие смены, проход людей
   и машин, записи журнала.

## Подсистемы

### Симулятор КПП

Ядро — конечный автомат агента в `useSimulatorPhysics.ts`:
`to_gate → waiting_before → crossing → moving_away → waiting_after → done`.
Пешеходы и машины ходят раздельно (калитка / шлагбаум), группы (семьи,
компаньоны) проходят по очереди за лидером, встречные потоки не смешиваются
(очередь направлений, FCFS). Спавн — 4 потока (пешие вход/выход, авто
вход/выход), интервалы по умолчанию в `app/utils/simTuning.ts`
(пешие 60–120 с, машины 90–180 с; пользовательские значения из настроек
имеют приоритет, но не ниже пола).

Анти-застойные предохранители (все пишут в консоль с префиксами
`[watchdog]`, `[crossing-cap]`, `[post-gate-cap]`, `[gate-missing]`,
`[direction-queue]`):

| Предохранитель  | Лимит                 | Действие при срабатывании    |
|-----------------|-----------------------|------------------------------|
| stall-watchdog  | 10 с без сдвига       | телепорт на текущую цель     |
| crossing-cap    | 15 с пеш. / 25 с авт. | перенос в конец прохода      |
| post-gate-cap   | 90 с                  | принудительное завершение (деспавн) |
| direction-queue | 25 с                  | проход вопреки встречному потоку |
| force-cross     | 5 с / 12 с (группа)   | принудительное начало прохода |

Анимация ходьбы ставится на паузу флагом `el.isPaused`, который считает
физика с гистерезисом (пауза < 0.1, пуск > 1.5 px/s) — без гистерезиса
класс мигал бы в очереди у прохода и «дёргал» руки/ноги спрайта.

### Журнал и смены

`useJournal` — записи въезда/выезда; симулятор сам предлагает запись по
фактам прохода (`logAgentEvent`). `useShift` — смена (синглтон), при
каждом старте симулятора принимается модалом «Смена не принята» →
«Принять смену».

### Поощрения и штрафы (payroll)

`usePayroll` — движок начислений: правила в конфиге `payroll_config`
(store `settings`), проводки в store `payroll` (миграция БД v10 → v11).
Принципы: суммы и капы считает только движок; идемпотентность через
`dedupe_key`; сверка фактов симулятора с записями журнала по
`personId` + временному окну; пауза начислений на перерыве.

### Редактор сцен

`/editor` — расстановка элементов (EditorCanvas, EditorSidebarLeft),
`/scenario-editor` — сценарии и команды, `/generator` — генератор людей.
Сцены хранятся в store `scenes` IndexedDB.

## Структура проекта

```
main.cjs                     # точка входа Electron (загружает .output/public)
app/
  assets/                    # CSS (Tailwind, темы)
  components/                # Vue-компоненты (editor/, SimulatorWidget.vue, ...)
  composables/               # useDatabase, useJournal, useShift, usePayroll, ...
    simulator/               # useSimulatorCore/Physics/Spawn/Integration/...
  pages/                     # index, editor, scenario-editor, generator,
                             # database, reports, settings, remote-panel
  types/                     # типы (simulator.ts: SceneElement, AiAgent, ...)
  utils/                     # simulatorMath, simulatorConstants, simTuning,
                             # personSvgRenderer, payrollBus
public/                      # статика
scripts/                     # fix-electron-paths.mjs, патчеры (*.py)
tests/                       # юнит-тесты vitest (физика, спавн, смены, настройки)
nuxt.config.ts               # порт 3001, ssr:false, hashMode, конфиг Electron
```

## Скрипты

| Команда       | Что делает                                        |
|---------------|---------------------------------------------------|
| `pnpm dev`    | Dev-сервер с hot-reload (порт 3001)               |
| `pnpm build`  | Продакшн-сборка (SSR-бандл)                       |
| `pnpm generate` | Статическая сборка — первый шаг к exe           |
| `pnpm preview` | Локальный просмотр продакшн-сборки               |
| `pnpm test`   | Юнит-тесты (vitest, разовый прогон)               |
| `pnpm test:watch` | Тесты в режиме слежения                       |
| `pnpm electron:build` | Портативный exe в `dist-electron/`        |
| `node scripts/fix-electron-paths.mjs` | Относительные пути в HTML (после `generate`) |

## Работа с GitHub (шпаргалка)

Репозиторий: https://github.com/igordolgov/journal-kpp

### Первоначальная настройка (один раз на новой машине)

Установить Git и GitHub CLI:

```bash
# Windows (winget)
winget install --id Git.Git
winget install --id GitHub.cli
```

Авторизоваться в GitHub CLI:

```bash
gh auth login
```

Выбрать: GitHub.com → HTTPS → Login with a web browser. Проверить:

```bash
gh auth status
```

### Клонирование проекта на новую машину

```bash
git clone https://github.com/igordolgov/journal-kpp.git
cd journal-kpp
pnpm install
```

### Повседневный workflow

1. Перед началом работы — подтянуть свежие изменения:

```bash
git pull
```

2. Поработать, внести изменения.

3. Посмотреть, что изменилось:

```bash
git status
git diff
```

4. Добавить изменения в индекс:

```bash
git add .                                # все файлы
# или выборочно:
git add app/components/SimulatorWidget.vue
```

5. Сделать коммит:

```bash
git commit -m "fix: убрать дёргание спрайтов у калитки"
```

Формат сообщений:

- `feat:` — новая функциональность
- `fix:` — исправление бага
- `docs:` — документация
- `chore:` — рутина (обновление зависимостей, чистка)
- `refactor:` — рефакторинг без изменения поведения
- `style:` — форматирование

6. Запушить на GitHub:

```bash
git push
```

### Работа с двух машин (Windows + Linux)

⚠️ Главное правило: всегда `git pull` перед началом работы.

Сценарий: работали на Windows, хотите продолжить на Linux.

На Windows:

```bash
git add .
git commit -m "..."
git push
```

На Linux:

```bash
git pull
# продолжаете работу
```

Если забыли `git pull` и получили `! [rejected]`:

```bash
git pull --rebase origin main
git push
```

`--rebase` аккуратно «переложит» ваши локальные коммиты поверх удалённых.

### Передача коммитов без пуша (git bundle)

Если на машине нет учётных данных GitHub (push невозможен, например
нет токена), коммиты переносят посылкой-бандлом:

```bash
# на машине с коммитами — собрать посылку
git bundle create journal-kpp-unpushed-commits.bundle origin/main..main
```

На машине-получателе (файл положить, например, в корень диска D:\):

```bash
git pull origin main                                   # 1. синхронизироваться с GitHub
git pull "D:\journal-kpp-unpushed-commits.bundle" main # 2. применить посылку
git push                                               # 3. отправить всё на GitHub
```

⚠️ Бандл требует базовый коммит — тот `origin/main`, на котором он
собирался. Без шага 1 будет ошибка
`error: Repository lacks these prerequisite commits`. Порядок строгий:
сначала `git pull origin main`, потом бандл, потом push.

### Полезные команды

```bash
git log --oneline -10                    # история
git show <hash>                          # что изменилось в коммите
git restore <файл>                       # отменить незакоммиченное
git checkout HEAD -- <файл>              # вернуть файл к последнему коммиту
git remote -v                            # проверить привязку репозитория
git push -u origin main                  # один раз, если no upstream branch
```

### Ветки (для экспериментов)

```bash
git checkout -b experiment-new-feature   # создать и переключиться
git push -u origin experiment-new-feature
git checkout main                        # вернуться в main
git merge experiment-new-feature         # слить, если эксперимент удался
git push
git branch -d experiment-new-feature     # удалить ветку
```

### Просмотр на GitHub

```bash
gh repo view --web
```

Или напрямую: https://github.com/igordolgov/journal-kpp

### Если что-то сломалось

Проверить, к какому репозиторию привязан проект:

```bash
git remote -v
```

Должно быть:

```
origin  https://github.com/igordolgov/journal-kpp.git
```

Если URL другой:

```bash
git remote set-url origin https://github.com/igordolgov/journal-kpp.git
```

Проверить, что ветка связана с удалённой:

```bash
git status
# должно быть: "Your branch is up to date with 'origin/main'"
```

Если push говорит `no upstream branch`:

```bash
git push -u origin main
```

Флаг `-u` нужен только один раз — потом `git push` работает без аргументов.

## Что НЕ попадает в репозиторий

Список исключений — в файле `.gitignore`. Не коммитятся:

- `node_modules/`, `.pnpm-store/` — зависимости
- `.nuxt/`, `.output/`, `dist/`, `dist-electron/` — сборка и exe
- `*.zip`, `*.rar`, `*.tar.gz` — архивы (в том числе доставочные)
- `.env`, `.env.*` — секреты и переменные окружения
- `dump-*.txt`, `*.tmp`, `*.bak` — дампы и временные файлы
- `*.log`, `coverage/` — логи и отчёты тестов
- `.idea/`, `.vscode/*` (кроме settings/extensions/launch) — настройки IDE

Если случайно закоммитили лишнее:

```bash
git rm --cached <файл>                   # убрать из индекса, оставить на диске
git commit -m "chore: удалить <файл> из репозитория"
```

## Известные проблемы и уроки

### Белый экран в exe

Симптом: exe запускается, окно пустое. Причина: абсолютные пути `/_nuxt/...`
в HTML при загрузке через `file://`. Решение — раздел «Сборка Electron»:
`pnpm generate` → `node scripts/fix-electron-paths.mjs` → `pnpm electron:build`.

### Windows + обновления Nuxt

Раньше Nuxt 4.6.0 на Windows падал с ошибкой
`Either manifest or precomputed data must be provided` в
`vue-bundle-renderer` (на Linux та же версия работала). Перед обновлением
Nuxt проверяйте сборку на Windows; при воспроизведении закрепите
последнюю рабочую версию в `package.json` без `^`.

### pnpm блокирует postinstall

Симптом: `ERR_PNPM_IGNORED_BUILDS`, отсутствие нативных бинарников
(esbuild, @parcel/watcher, electron). Решение: блок `allowScripts` в
`package.json` уже прописан; если pnpm всё равно спрашивает —
`pnpm approve-builds` → выбрать все → `pnpm rebuild`.

### Перенос с Linux на Windows

Удалить `node_modules/`, `.nuxt/`, `.output/`, `pnpm-lock.yaml`, затем
`pnpm install` — пересобрать нативные бинарники.

### Зависания агентов в симуляторе

Симптом: агент стоит на месте («вошёл и замер»). Диагностика: открыть
консоль (F12 в dev / devtools Electron) и искать префиксы
`[watchdog]`, `[crossing-cap]`, `[post-gate-cap]`, `[direction-queue]` —
каждое срабатывание логируется с типом и id агента. Правильный фикс —
устранить причину (цель, геометрия сцены), а не отключать предохранители:
они страховочные, штатно не срабатывают.

### Локальная копия отстала от GitHub

Симптомы: `git push` отклонён — `! [rejected] main -> main (fetch first)`,
«remote contains work that you do not have locally»; бандл не применяется —
`error: Repository lacks these prerequisite commits`. Причина: коммиты
попадали на GitHub в обход этой машины (веб-редактор GitHub, вторая
машина). Решение: сначала `git pull origin main`, и только потом бандл
и push. Проверка: `git log --oneline -5` — верхний коммит локальной
ветки должен совпадать с `origin/main`.

### IndexedDB и миграции

Миграция выполняется в `onupgradeneeded`: создаются только недостающие
сторы, данные не трогаются (v11 добавил store `payroll`). При отладке
очищать БД через страницу `/database`, а не удалением файлов.

## Соглашения по коду

- Компоненты: PascalCase (`SimulatorWidget.vue`)
- Composables: camelCase с префиксом `use` (`usePayroll.ts`)
- Типы: в `app/types/` или локально в `<script setup>`
- Стили: TailwindCSS utility-классы, кастомные — в `app/assets/css/`
- В pug-шаблонах классы со спецсимволами (`hover:bg-*`, `py-2.5`, `lg:block`)
  — только внутри `class="..."`; точечный синтаксис — только классы из
  букв/цифр/дефисов
- Комментарии: на русском, для сложной логики — «почему», а не «что»
- Физика симулятора — единственный источник правды о состояниях агентов;
  UI не дублирует вычисления
- Начисления (payroll): суммы, капы и дедупликацию считает только движок
  `usePayroll`, компоненты только показывают
- Идемпотентность: повторные операции не дублируют эффекты
  (`dedupe_key` в payroll, `fix-electron-paths.mjs` перезаписывает файлы
  только при реальных заменах)
- Коммиты — conventional commits

## Лицензия

Учебный проект. Свободное использование в образовательных целях.
