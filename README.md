# Журнал КПП

Система контроля пропускного пункта. Electron-приложение на Nuxt 4.

## Разработка

    pnpm install
    pnpm dev
    # открыть http://localhost:3001/

## Сборка Electron

    pnpm build
    pnpm electron:build

## ⚠️ Ограничения платформы

- **Nuxt 4.6.0 не работает на Windows** — падает с
  `Either manifest or precomputed data must be provided` в `vue-bundle-renderer`.
  На Linux работает. Используйте **4.5.2** (закреплено без `^` в package.json).

- При переносе проекта с Linux на Windows: удалить `node_modules`, `.nuxt`,
  `pnpm-lock.yaml`, затем `pnpm install`.

## Стек

- Nuxt 4.5.2, Vue 3.5, Vue Router 5
- TailwindCSS 4 + daisyUI 5
- GSAP, Chart.js, Fuse.js, nanoid
- TypeScript 5.9, pnpm 11

## Рабочий процесс

# Ежедневная работа
git pull                    # подтянуть свежие изменения
# ... редактируете код ...
git add .
git commit -m "feat: ..."
git push

Для экспериментов:
bash

git checkout -b experiment-nuxt-4.6
# ... пробуете обновить Nuxt ...
git push -u origin experiment-nuxt-4.6
# Если работает — merge в main. Если нет — просто не merge.

Для откатов:
bash

git log --oneline              # найти нужный коммит
git checkout <hash> -- .       # вернуть файлы на момент коммита