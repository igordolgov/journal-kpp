<!-- app/pages/settings.vue -->
<template lang="pug">
.settings-page.flex.flex-col.h-full
  //- Шапка
  .flex-none.p-4.border-b.bg-base-100(
    class="border-base-300"
  )
    h2.text-2xl.font-bold
      | ⚙️ Настройки системы

  //- Основной контент (Скролл контейнер)
  .flex-1.overflow-y-auto.p-4.relative(
    class="bg-base-300"
  )
    
    //- Табы
    .tabs.mb-4.bg-base-100.tabs-boxed
      button.tab(
        :class="{ 'tab-active': activeTab === 'ui' }"
        @click="activeTab = 'ui'"
      )
        | Интерфейс
      button.tab(
        :class="{ 'tab-active': activeTab === 'labels' }"
        @click="activeTab = 'labels'"
      )
        | Названия
      button.tab(
        :class="{ 'tab-active': activeTab === 'columns' }"
        @click="activeTab = 'columns'"
      )
        | Поля журнала
      button.tab(
        :class="{ 'tab-active': activeTab === 'buttons' }"
        @click="activeTab = 'buttons'"
      )
        | Кнопки
      button.tab(
        :class="{ 'tab-active': activeTab === 'places' }"
        @click="activeTab = 'places'"
      )
        | Места
      button.tab(
        :class="{ 'tab-active': activeTab === 'simulator' }"
        @click="activeTab = 'simulator'"
      )
        | Симулятор
      button.tab(
        :class="{ 'tab-active': activeTab === 'generator' }"
        @click="activeTab = 'generator'"
      )
        | Генератор

    //- 1. ВКЛАДКА ИНТЕРФЕЙС
    .card.mb-6.shadow.bg-base-100(
      v-if="activeTab === 'ui'"
    )
      .card-body
        h4.card-title
          | Общий вид

        .flex.items-end.justify-between.mb-6
          //- Выбор темы
          .form-control
            label.label
              span.label-text.font-bold Тема оформления
            .flex.flex-wrap.gap-2.mt-2
              button.btn.rounded-lg(
                v-for="t in availableThemes"
                :key="t.id"
                :class="theme === t.id ? 'btn-primary' : 'btn-outline border-2 border-secondary/50'"
                @click="theme = t.id"
              )
                | {{ t.name }}

          //- Глобальный размер шрифта
          .form-control
            label.label.mb-2
              span.label-text.font-bold Общий размер шрифта ({{ fontSize }}px)
            input.range.range-sm.rounded-full.range-primary(
              type="range"
              min="12"
              max="20"
              step="1"
              v-model.number="fontSize"
              class="bg-primary/20"
            )

        .divider.mt-0
          | Таблица журнала

        .flex.items-end.justify-between.mb-6
          //- Плотность строк
          .form-control
            label.label
              span.label-text.font-bold Плотность строк
            .flex.gap-2.mt-2
              button.btn.btn-sm.rounded-lg(
                :class="uiSettings.tableDensity === 'compact' ? 'btn-primary' : 'btn-outline border-2 border-secondary/50'"
                @click="uiSettings.tableDensity = 'compact'"
              )
                | Компактная
              button.btn.btn-sm.rounded-lg(
                :class="uiSettings.tableDensity === 'normal' ? 'btn-primary' : 'btn-outline border-2 border-secondary/50'"
                @click="uiSettings.tableDensity = 'normal'"
              )
                | Стандартная
              button.btn.btn-sm.rounded-lg(
                :class="uiSettings.tableDensity === 'comfortable' ? 'btn-primary' : 'btn-outline border-2 border-secondary/50'"
                @click="uiSettings.tableDensity = 'comfortable'"
              )
                | Комфортная

          //- Размер шрифта таблицы
          .form-control
            label.label.mb-2
              span.label-text.font-bold Размер шрифта в таблице ({{ uiSettings.tableFontSize }}px)
            input.range.range-sm.rounded-full.range-primary(
              type="range"
              min="10"
              max="18"
              step="1"
              v-model.number="uiSettings.tableFontSize"
              class="bg-primary/20"
            )

    //- 2. ВКЛАДКА НАЗВАНИЯ
    .card.mb-2.shadow.bg-base-100(
      v-if="activeTab === 'labels'"
    )
      .card-body
        h4.card-title.mb-2
          | Переименование полей
        
        //- CSS Grid для формы
        .grid.gap-2(
          class="grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-2"
        )
          .form-control.flex.justify-between(
            v-for="(val, key) in labels"
            :key="key"
          )
            label.label.mr-2
              span.label-text.font-semibold.text-gray-500
                | {{ key }}:
            input.input.input-sm.input-bordered(
              v-model="labels[key]"
            )

    //- 3. ВКЛАДКА ПОЛЯ ЖУРНАЛА
    .card.mb-5.shadow.bg-base-100(
      v-if="activeTab === 'columns'"
    )
      .card-body.max-w-lg
        h4.card-title.mb-0
          | Порядок колонок
        table.table.w-full.table-zebra
          thead
            tr
              th.w-16 Вид.
              th Поле
              th.w-20 Действия
          tbody
            tr(
              v-for="(col, index) in columns"
              :key="col.key"
            )
              td
                input.checkbox(
                  type="checkbox"
                  v-model="col.visible"
                )
              td
                | {{ configStore.getLabel(col.key) }}
              td
                .join
                  button.join-item.btn.btn-xs.btn-outline(
                    @click="configStore.moveItem('journalColumns', index, -1)"
                  )
                    | ▲
                  button.join-item.btn.btn-xs.btn-outline(
                    @click="configStore.moveItem('journalColumns', index, 1)"
                  )
                    | ▼

    //- 4. ВКЛАДКА КНОПКИ
    .card.mb-6.shadow.bg-base-100(
      v-if="activeTab === 'buttons'"
    )
      .card-body.max-w-lg
        h4.card-title.mb-4
          | Кнопки действий
        table.table.w-full.table-zebra
          thead
            tr
              th.w-16 Вид.
              th Название
              th.w-20 Действия
          tbody
            tr(
              v-for="(btn, index) in buttons"
              :key="btn.key"
            )
              td
                input.checkbox(
                  type="checkbox"
                  v-model="btn.visible"
                )
              td
                input.input.w-full.input-sm.input-bordered(
                  v-model="btn.label"
                )
              td
                .join
                  button.join-item.btn.btn-xs.btn-outline(
                    @click="configStore.moveItem('actionButtons', index, -1)"
                  )
                    | ▲
                  button.join-item.btn.btn-xs.btn-outline(
                    @click="configStore.moveItem('actionButtons', index, 1)"
                  )
                    | ▼

    //- 5. ВКЛАДКА МЕСТА
    .card.mb-6.shadow.bg-base-100(
      v-if="activeTab === 'places'"
    )
      .card-body
        h4.card-title.mb-4
          | Популярные места назначения
        p.text-sm.text-gray-500.mb-4
          | Эти кнопки будут отображаться при фиксации выхода/прибытия.

        .form-control
          .join.mb-4.w-full
            input.join-item.input.input-bordered.flex-1(
              v-model="newPlace"
              placeholder="Например: Склад, Банк, Отпуск"
              @keyup.enter="addPlace"
            )
            button.join-item.btn.btn-primary(
              @click="addPlace"
            )
              | Добавить
        
        .divider.mt-0.mb-2
          | Список мест

        .flex.flex-wrap.gap-2(
          v-if="destinations.length"
        )
          .badge.badge-lg.gap-2.shadow-sm.badge-primary(
            v-for="(place, index) in destinations"
            :key="index"
          )
            | {{ place }}
            button.btn.btn-ghost.btn-xs.p-0.h-auto(
              @click="removePlace(index)"
            )
              svg.h-4.w-4(
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              )
                path(
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                )
        .text-gray-400(v-else)
          | Список пуст. Добавьте часто используемые места.

    //- 6. ВКЛАДКА СИМУЛЯТОР
    .card.mb-6.shadow.bg-base-100(
      v-if="activeTab === 'simulator'"
    )
      .card-body
        h4.card-title.mb-4
          | ⚡ Параметры физики
        p.text-sm.text-gray-500.mb-4
          | Настройки движения и поведения машин в симуляции. Требуется перезапуск симуляции для применения.

        .grid.gap-6(
          class="grid-cols-1 md:grid-cols-4"
        )
          //- Группа: Движение
          .border-2.border-neutral-600.p-4.rounded-lg.bg-base-200
            h5.font-bold.mb-3 🚗 Движение
            .form-control.mb-2
              label.label
                span.label-text Ускорение (px/сек²)
              input.input.input-sm.input-bordered(
                type="number"
                v-model.number="simSettings.ACCEL"
              )
            .form-control.mb-2
              label.label
                span.label-text Торможение (px/сек²)
              input.input.input-sm.input-bordered(
                type="number"
                v-model.number="simSettings.DECEL"
              )
            .form-control
              label.label
                span.label-text Порог прибытия (px)
              input.input.input-sm.input-bordered(
                type="number"
                v-model.number="simSettings.ARRIVE_THRESHOLD"
              )

          //- Группа: Коллизии
          .border-2.border-neutral-600.p-4.rounded-lg.bg-base-200
            h5.font-bold.mb-3 💥 Коллизии
            .form-control.mb-2
              label.label
                span.label-text Время реакции (сек)
              input.input.input-sm.input-bordered(
                type="number"
                step="0.1"
                v-model.number="simSettings.REACTION_TIME"
              )
            .form-control.mb-2
              label.label
                span.label-text Буфер безопасности (px)
              input.input.input-sm.input-bordered(
                type="number"
                v-model.number="simSettings.MIN_BUFFER"
              )
            .form-control
              label.label
                span.label-text Дальность зрения (px)
              input.input.input-sm.input-bordered(
                type="number"
                v-model.number="simSettings.MAX_LOOKAHEAD"
              )

          //- Группа: Тупики
          .border-2.border-neutral-600.p-4.rounded-lg.bg-base-200
            h5.font-bold.mb-3 🚧 Тупики и Реверс
            .form-control.mb-2
              label.label
                span.label-text Время до отката (сек)
              input.input.input-sm.input-bordered(
                type="number"
                step="0.5"
                v-model.number="simSettings.DEADLOCK_TIME"
              )
            .form-control.mb-2
              label.label
                span.label-text Время реверса (сек)
              input.input.input-sm.input-bordered(
                type="number"
                step="0.1"
                v-model.number="simSettings.REVERSE_TIME"
              )
            .form-control
              label.label
                span.label-text Скорость реверса (px/сек)
              input.input.input-sm.input-bordered(
                type="number"
                v-model.number="simSettings.REVERSE_SPEED"
              )
          
          //- Группа: Графика
          .border-2.border-neutral-600.p-4.rounded-lg.bg-base-200
            h5.font-bold.mb-3 🎨 Графика
            .form-control
              label.label
                span.label-text Смещение спрайта (радианы)
              input.input.input-sm.input-bordered(
                type="number"
                step="0.1"
                v-model.number="simSettings.SPRITE_ORIENTATION_OFFSET"
              )
              label.label
                span.label-text-alt.text-xs
                  | 0=Вправо, 1.57=Вниз, 3.14=Влево, -1.57=Вверх

    //- 6. ВКЛАДКА СИМУЛЯТОР
    .card.mb-6.shadow.bg-base-100(v-if="activeTab === 'simulator'")
      .card-body
        h4.card-title.mb-4
          | ⚡ Настройки симуляции
        p.text-sm.text-gray-500.mb-6
          | Изменения применяются после перезапуска симуляции (кнопка «Запустить» в редакторе).

        .grid.grid-cols-1(class="lg:grid-cols-2 gap-6")
          //- ЛЕВАЯ КОЛОНКА
          .space-y-6
            //- Блок: Общие
            .border.border-base-300.rounded-xl.p-4.bg-base-200
              .flex.items-center.gap-2.mb-3
                span.text-xl 🌍
                h5.font-bold Общие
              .grid.grid-cols-1(class="sm:grid-cols-2 gap-4")
                .form-control
                  label.label
                    span.label-text Включить трафик
                    input.toggle.toggle-sm.toggle-primary(v-model="simSettings.enabled")
                .form-control
                  label.label
                    span.label-text Макс. агентов
                  input.input.input-sm.input-bordered(type="number" v-model.number="simSettings.maxAgents" min="1" max="100")

            //- Блок: Спавн людей
            .border.border-base-300.rounded-xl.p-4.bg-base-200
              .flex.items-center.gap-2.mb-3
                span.text-xl 🚶‍♂️
                h5.font-bold Спавн людей
              .grid.grid-cols-2.gap-4
                .form-control
                  label.label
                    span.label-text Мин. интервал (сек)
                  input.input.input-sm.input-bordered(type="number" v-model.number="simSettings.spawnIntervalMin" step="1" min="1")
                .form-control
                  label.label
                    span.label-text Макс. интервал (сек)
                  input.input.input-sm.input-bordered(type="number" v-model.number="simSettings.spawnIntervalMax" step="1" min="1")

            //- Блок: Спавн машин
            .border.border-base-300.rounded-xl.p-4.bg-base-200
              .flex.items-center.gap-2.mb-3
                span.text-xl 🚗
                h5.font-bold Спавн машин
              .grid.grid-cols-2.gap-4
                .form-control
                  label.label
                    span.label-text Мин. интервал (сек)
                  input.input.input-sm.input-bordered(type="number" v-model.number="simSettings.carSpawnIntervalMin" step="1" min="1")
                .form-control
                  label.label
                    span.label-text Макс. интервал (сек)
                  input.input.input-sm.input-bordered(type="number" v-model.number="simSettings.carSpawnIntervalMax" step="1" min="1")

            //- Блок: Люди
            .border.border-base-300.rounded-xl.p-4.bg-base-200
              .flex.items-center.gap-2.mb-3
                span.text-xl 🧑‍🤝‍🧑
                h5.font-bold Люди
              .grid.grid-cols-2.gap-4
                .form-control
                  label.label
                    span.label-text Скорость (px/сек)
                  input.input.input-sm.input-bordered(type="number" v-model.number="simSettings.personSpeed" step="5" min="10")
                .form-control
                  label.label
                    span.label-text Вес "На территории"
                  input.input.input-sm.input-bordered(type="number" v-model.number="simSettings.locationWeightInside" step="0.1" min="0.5")
              .grid.grid-cols-2.gap-4.mt-2
                .form-control
                  label.label
                    span.label-text Ширина (px)
                  input.input.input-sm.input-bordered(type="number" v-model.number="simSettings.personWidth" step="5" min="20")
                .form-control
                  label.label
                    span.label-text Высота (px)
                  input.input.input-sm.input-bordered(type="number" v-model.number="simSettings.personHeight" step="5" min="20")

            //- Блок: Машины
            .border.border-base-300.rounded-xl.p-4.bg-base-200
              .flex.items-center.gap-2.mb-3
                span.text-xl 🚙
                h5.font-bold Машины
              .grid.grid-cols-2.gap-4
                .form-control
                  label.label
                    span.label-text Скорость (px/сек)
                  input.input.input-sm.input-bordered(type="number" v-model.number="simSettings.carSpeed" step="5" min="10")
                .form-control
                  label.label
                    span.label-text Ширина (px)
                  input.input.input-sm.input-bordered(type="number" v-model.number="simSettings.carWidth" step="5" min="20")
                .form-control
                  label.label
                    span.label-text Высота (px)
                  input.input.input-sm.input-bordered(type="number" v-model.number="simSettings.carHeight" step="5" min="20")

          //- ПРАВАЯ КОЛОНКА
          .space-y-6
            //- Блок: Ворота и калитка
            .border.border-base-300.rounded-xl.p-4.bg-base-200
              .flex.items-center.gap-2.mb-3
                span.text-xl 🚪
                h5.font-bold Ворота и калитка
              .grid.grid-cols-2.gap-4
                .form-control
                  label.label
                    span.label-text Закрытие ворот (сек)
                  input.input.input-sm.input-bordered(type="number" v-model.number="simSettings.gateCloseDelay" step="1" min="0")
                .form-control
                  label.label
                    span.label-text Закрытие калитки (сек)
                  input.input.input-sm.input-bordered(type="number" v-model.number="simSettings.wicketCloseDelay" step="1" min="0")
              .grid.grid-cols-2.gap-4.mt-2
                .form-control
                  label.label.cursor-pointer
                    span.label-text Автооткрытие ворот
                    input.toggle.toggle-sm.toggle-primary(v-model="simSettings.autoOpenGates")
                .form-control
                  label.label.cursor-pointer
                    span.label-text Автооткрытие калитки
                    input.toggle.toggle-sm.toggle-primary(v-model="simSettings.autoOpenWicket")

            //- Блок: Физика движения
            .border.border-base-300.rounded-xl.p-4.bg-base-200
              .flex.items-center.gap-2.mb-3
                span.text-xl ⚙️
                h5.font-bold Физика движения
              .grid.grid-cols-2.gap-x-4.gap-y-2
                .form-control
                  label.label
                    span.label-text Ускорение (px/сек²)
                  input.input.input-xs.input-bordered(type="number" v-model.number="simSettings.ACCEL" step="10")
                .form-control
                  label.label
                    span.label-text Торможение (px/сек²)
                  input.input.input-xs.input-bordered(type="number" v-model.number="simSettings.DECEL" step="10")
                .form-control
                  label.label
                    span.label-text Время реакции (сек)
                  input.input.input-xs.input-bordered(type="number" step="0.1" v-model.number="simSettings.REACTION_TIME")
                .form-control
                  label.label
                    span.label-text Буфер (px)
                  input.input.input-xs.input-bordered(type="number" v-model.number="simSettings.MIN_BUFFER")
                .form-control
                  label.label
                    span.label-text Дальность (px)
                  input.input.input-xs.input-bordered(type="number" v-model.number="simSettings.MAX_LOOKAHEAD")
                .form-control
                  label.label
                    span.label-text Время до отката (сек)
                  input.input.input-xs.input-bordered(type="number" step="0.5" v-model.number="simSettings.DEADLOCK_TIME")
                .form-control
                  label.label
                    span.label-text Время реверса (сек)
                  input.input.input-xs.input-bordered(type="number" step="0.1" v-model.number="simSettings.REVERSE_TIME")
                .form-control
                  label.label
                    span.label-text Скорость реверса (px/сек)
                  input.input.input-xs.input-bordered(type="number" v-model.number="simSettings.REVERSE_SPEED")
                .form-control
                  label.label
                    span.label-text Смещение спрайта (рад)
                  input.input.input-xs.input-bordered(type="number" step="0.1" v-model.number="simSettings.SPRITE_ORIENTATION_OFFSET")
                  span.label-text-alt.text-xs.mt-1 (0=вправо, 1.57=вниз)
                .form-control
                  label.label
                    span.label-text Порог прибытия (px)
                  input.input.input-xs.input-bordered(type="number" v-model.number="simSettings.ARRIVE_THRESHOLD" step="0.5")

    //- 7. ВКЛАДКА ГЕНЕРАТОР
    .card.mb-6.shadow.bg-base-100(
      v-if="activeTab === 'generator'"
    )
      .card-body
        h4.card-title.mb-2
          | 🧬 Генератор тестовых данных
        
          span.text-sm.text-gray-500.ml-4
            | Настройки структуры семей и запуск генерации населения.

        //- Настройки параметров
        .grid.gap-4.mb-2(
          class="grid-cols-1 md:grid-cols-4"
        )
          //- Кол-во семей
          .border-2.border-neutral-600.p-4.rounded-lg.bg-base-200
            h5.font-bold.mb-3 🏠 Объем
            .form-control.mb-2
              label.label
                span.label-text Кол-во семей
                input.input.input-sm.input-bordered(
                  type="number"
                  v-model.number="seederSettings.familiesCount"
                )
            .form-control.mb-2
              label.label
                span.label-text Мин. детей
                input.input.input-sm.input-bordered(
                  type="number"
                  v-model.number="seederSettings.minKids"
                )
            .form-control
              label.label
                span.label-text Макс. детей
                input.input.input-sm.input-bordered(
                  type="number"
                  v-model.number="seederSettings.maxKids"
                )

          //- Глава семьи
          .border-2.border-neutral-600.p-4.rounded-lg.bg-base-200
            h5.font-bold.mb-3 👑 Глава семьи
            .form-control.mb-2
              label.label
                span.label-text Вероятность мужчины (0-1)
                input.input.input-sm.input-bordered(
                  type="number" step="0.1" min="0" max="1"
                  v-model.number="seederSettings.headIsMaleChance"
                )
            .form-control
              label.label
                span.label-text Вероятность пенсионера (0-1)
                input.input.input-sm.input-bordered(
                  type="number" step="0.1" min="0" max="1"
                  v-model.number="seederSettings.headIsSeniorChance"
                )

          //- Родственники
          .border-2.border-neutral-600.p-4.rounded-lg.bg-base-200
            h5.font-bold.mb-3 👨‍👩‍👧‍👦 Родственники (0-1)
            .form-control.mb-2
              label.label
                span.label-text Супруг(а)
                input.input.input-sm.input-bordered(
                  type="number" step="0.1" min="0" max="1"
                  v-model.number="seederSettings.spouseChance"
                )
            .form-control.mb-2
              label.label
                span.label-text Братья/Сестры
                input.input.input-sm.input-bordered(
                  type="number" step="0.1" min="0" max="1"
                  v-model.number="seederSettings.siblingChance"
                )
            .form-control.mb-2
              label.label
                span.label-text Супруги брата/сестры
                input.input.input-sm.input-bordered(
                  type="number" step="0.1" min="0" max="1"
                  v-model.number="seederSettings.siblingSpouseChance"
                )
            .form-control.mb-2
              label.label
                span.label-text Племянники
                input.input.input-sm.input-bordered(
                  type="number" step="0.1" min="0" max="1"
                  v-model.number="seederSettings.nephewChance"
                )
            .form-control
              label.label
                span.label-text Родители главы
                input.input.input-sm.input-bordered(
                  type="number" step="0.1" min="0" max="1"
                  v-model.number="seederSettings.parentsChance"
                )

          //- Транспорт
          .border-2.border-neutral-600.p-4.rounded-lg.bg-base-200
            h5.font-bold.mb-3 🚗 Транспорт
            .form-control.mb-2
              label.label
                span.label-text Регион (код)
                input.input.input-sm.input-bordered(
                  type="text" maxlength="3"
                  v-model="seederSettings.vehicleRegionCode"
                  placeholder="77"
                )
            .form-control.mb-2
              label.label
                span.label-text Шанс авто у взрослых
                input.input.input-sm.input-bordered(
                  type="number" step="0.1" min="0" max="1"
                  v-model.number="seederSettings.vehicleChanceAdult"
                )
            .form-control
              label.label
                span.label-text Шанс авто у пенсионеров
                input.input.input-sm.input-bordered(
                  type="number" step="0.1" min="0" max="1"
                  v-model.number="seederSettings.vehicleChanceSenior"
                )

        //- Блок запуска
        .alert.shadow-lg.bg-base-300
          .flex-1
            .form-control
              label.label.cursor-pointer.justify-start.gap-3
                input.checkbox.checkbox-sm.checkbox-error(
                  type="checkbox" 
                  v-model="clearBeforeGenerate"
                )
                span.label-text 
                  span.font-bold.text-error Очистить базу перед созданием
                  span.text-xs.block (Удалит всех текущих жителей и записи журнала)
          .flex-none
            button.btn.btn-primary.btn-wide(
              @click="handleGenerate"
              :disabled="loading"
            )
              span.loading.loading-spinner.loading-xs(v-if="loading")
              span(v-else) ▶️ Создать семьи

    //- Блок действий (Сохранение / Импорт / Экспорт)
    .sticky.bottom-0.left-0.right-0.p-4.bg-base-300.z-10
      button.btn.btn-block.btn-primary(
        @click="saveSettings"
      )
        | 💾 Сохранить изменения

      .divider
        | Резерв
      .flex.gap-2
        button.btn.rounded-md.btn-outlineborder-2.border-secondary(
          @click="handleExport"
        )
          | 📥 Скачать
        label.btn.rounded-lg.btn-outlineborder-2.border-secondary
          | 📤 Загрузить
          input.hidden(
            type="file"
            accept=".json"
            @change="handleImport"
          )
        button.btn.rounded-md.btn-error(
          @click="clearAllData"
        )
          | 🗑 Очистить
</template>

<script setup lang="ts">
// app/pages/settings.vue
import { ref, computed, onMounted } from 'vue'
import { useDatabase } from '../composables/useDatabase'
import { useConfig } from '../composables/useConfig'
import { useTheme } from '../composables/useTheme'
import { useSeeder } from '../composables/useSeeder'

// --- Composables ---
const { exportDB, importDB } = useDatabase()
const configStore = useConfig()
const { theme, fontSize, availableThemes, loadTheme } = useTheme()
const { generatePopulation } = useSeeder()

// --- State ---
const activeTab = ref('ui')
const newPlace = ref('')

// Состояние для генератора
const loading = ref(false)
const clearBeforeGenerate = ref(true)

// --- Computed Config ---
const labels = computed(() => configStore.config.value.labels)
const columns = computed(() => configStore.config.value.journalColumns)
const buttons = computed(() => configStore.config.value.actionButtons)
const uiSettings = computed(() => configStore.config.value.ui)

// Настройки для новых вкладок
const simSettings = computed(() => configStore.config.value.simulator)
const seederSettings = computed(() => configStore.config.value.seeder)

// --- Places Logic ---
const destinations = computed({
  get: () => configStore.config.value.destinations || [],
  set: (val) => configStore.config.value.destinations = val
})

const addPlace = () => {
  const val = newPlace.value.trim()
  if (val && !destinations.value.includes(val)) {
    destinations.value = [...destinations.value, val]
    newPlace.value = ''
  }
}

const removePlace = (index: number) => {
  const updated = [...destinations.value]
  updated.splice(index, 1)
  destinations.value = updated
}

// --- Actions ---
const saveSettings = async () => {
  await configStore.saveConfig()
  alert('Настройки сохранены! Страница будет перезагружена для применения.')
  window.location.reload()
}

const handleExport = async () => {
  await exportDB()
  alert('Готово!')
}

const handleImport = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file && confirm('Заменить данные?')) {
    await importDB(file)
    window.location.reload()
  }
}

const clearAllData = () => {
  if (confirm('Удалить базу?')) {
    indexedDB.deleteDatabase('SecurityJournalDB')
    window.location.reload()
  }
}

// --- Generator Logic ---
const handleGenerate = async () => {
  if (loading.value) return
  
  if (clearBeforeGenerate.value) {
    if (!confirm('Внимание! Будут удалены все текущие жители и записи журнала. Продолжить?')) {
      return
    }
  }

  loading.value = true
  
  try {
    const count = seederSettings.value.familiesCount || 10
    const result = await generatePopulation(count, clearBeforeGenerate.value)
    
    if (result.success) {
      alert(`Успех! Создано ${result.count} человек.`)
    } else {
      alert('Ошибка генерации.')
    }
  } catch (e) {
    console.error(e)
    alert('Критическая ошибка')
  } finally {
    loading.value = false
  }
}

// --- Lifecycle ---
onMounted(async () => {
  await configStore.loadConfig()
  loadTheme()
})
</script>