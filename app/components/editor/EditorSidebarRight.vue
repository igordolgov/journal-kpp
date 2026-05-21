<!-- app\components\editor\EditorSidebarRight.vue -->
<template lang='pug'>
aside.flex.flex-col.h-full.overflow-hidden.border-l.border-gray-700.bg-gray-900
  .flex.h-7.items-center.justify-between.border-b.border-gray-700.p-1.px-2.bg-gray-800
    span.text-xs.font-bold Инспектор
    
    button.btn.btn-ghost.btn-xs.text-red-400.w-6.h-6.p-0(
      v-if="selectedElement"
      @click="$emit('delete:element', selectedElement.id)"
      title="Удалить объект"
    ) 🗑️
    
    button.btn.btn-ghost.btn-xs.text-red-400.w-6.h-6.p-0(
      v-else-if="selectedPanel && !selectedControl"
      @click="$emit('delete-panel', selectedPanel.id)"
      title="Удалить панель"
    ) 🗑️

  .flex-1.overflow-y-auto.p-2.text-xs
    //- ==========================================
    //- ВЫБРАН ЭЛЕМЕНТ СЦЕНЫ
    //- ==========================================
    template(v-if="selectedElement")
      .mb-2
        .grid.grid-cols-2.gap-2
          .flex
            .mb-1.text-gray-400 Название:
            input.input.input-xs.input-bordered.bg-gray-800(type="text" :value="selectedElement.name" @input="handleInput('name', $event.target.value)")
          .flex
            .mb-1.text-gray-400 Роль:
            select.select.select-xs.select-bordered.rounded-md.bg-gray-800(:value="selectedElement.type" @change="handleInput('type', $event.target.value)")
              option(value="element") Обычный элемент
              option(value="actor") Актер
              option(value="gate") Ворота/Калитка
              option(value="zone") Зона
              
      .mb-2.text-gray-400 Позиция и Размер:
      .grid.grid-cols-4.gap-2.mb-2
        .flex.items-center
          label.text-gray-400 X:
          input.input.input-xs.input-bordered.w-full.bg-gray-800(type="number" :value="selectedElement.x" @input="handleInput('x', Number($event.target.value))")
        .flex.items-center
          label.text-gray-400 Y:
          input.input.input-xs.input-bordered.w-full.bg-gray-800(type="number" :value="selectedElement.y" @input="handleInput('y', Number($event.target.value))")
        .flex.items-center
          label.text-gray-400 W:
          input.input.input-xs.input-bordered.w-full.bg-gray-800(type="number" :value="selectedElement.width" @input="onWidthChange")
        .flex.items-center
          label.text-gray-400 H:
          input.input.input-xs.input-bordered.w-full.bg-gray-800(type="number" :value="selectedElement.height" @input="onHeightChange")
          button.btn.btn-ghost.btn-xs.flex-shrink-0.w-6.h-6.p-0(:class="aspectRatioLocked ? 'text-blue-400' : 'text-gray-600'" @click="toggleLock") 🔒

      //- УПРАВЛЕНИЕ Z-УРОВНЕМ
      .mb-2.text-gray-400 Слои и порядок:
      .flex.items-center.gap-2.mb-2
        button.btn.btn-ghost.btn-xs.w-8.h-8.p-0.text-gray-400(@click="handleZIndex(-10)" title="На задний план") ⬇
        input.input.input-xs.input-bordered.w-16.text-center.bg-gray-800(type="number" :value="selectedElement.zIndex || 0" @input="handleInput('zIndex', Number($event.target.value))")
        button.btn.btn-ghost.btn-xs.w-8.h-8.p-0.text-gray-400(@click="handleZIndex(10)" title="На передний план") ⬆

      //- ==========================================
      //- БЛОК ДЛЯ ВОРОТ/КАЛИТКИ
      //- ==========================================
      template(v-if="isGateElement")
        .mt-3.rounded.p-2.bg-gray-800
          .mb-2.text-gray-400 Свойства ворот/калитки
          .flex.items-center.gap-2.mb-2
            span.text-gray-400 Тип:
            select.select.select-xs.select-bordered.bg-gray-800(:value="selectedElement.settings?.gateType" @change="updateGateType($event.target.value)")
              option(value="") — Выберите тип —
              option(value="sliding") Откатные (ворота)
              option(value="wicket") Распашная (калитка)
            button.btn.btn-xs.border-none(:class="selectedElement.settings?.isOpen ? 'btn-success' : 'btn-warning'" @click="toggleGateOpen") {{ selectedElement.settings?.isOpen ? 'Открыты' : 'Закрыты' }}
          .flex.items-center.gap-2.mb-2
            span.w-24.text-gray-400 Время открытия:
            input.input.input-xs.input-bordered.w-20.bg-gray-800(type="number" step="0.5" min="0.5" :value="selectedElement.settings?.openDuration || 2" @input="updateGateDuration('open', Number($event.target.value))")
            span.text-gray-400 сек
          .flex.items-center.gap-2.mb-2
            span.w-24.text-gray-400 Время закрытия:
            input.input.input-xs.input-bordered.w-20.bg-gray-800(type="number" step="0.5" min="0.5" :value="selectedElement.settings?.closeDuration || 2" @input="updateGateDuration('close', Number($event.target.value))")
            span.text-gray-400 сек

          .mt-3.pt-2.border-t.border-gray-700
          .mb-2.text-gray-400 Внешний вид
          .grid.grid-cols-2.gap-2.mb-2
            .flex.items-center.gap-1
              label.text-gray-400 Фон:
              input.input.input-xs.input-bordered.w-10.h-6.p-0.flex-shrink-0.bg-gray-800(type="color" :value="selectedElement.settings?.frameColor || '#000000'" @input="updateGateStyle('frameColor', $event.target.value)")
              input.input.input-xs.input-bordered.w-full.bg-gray-900(type="text" :value="selectedElement.settings?.frameColor || 'none'" @input="updateGateStyle('frameColor', $event.target.value)")
            .flex.items-center.gap-1
              label.text-gray-400 Прутки:
              input.input.input-xs.input-bordered.w-10.h-6.p-0.flex-shrink-0.bg-gray-800(type="color" :value="selectedElement.settings?.barColor || '#9ca3af'" @input="updateGateStyle('barColor', $event.target.value)")
              input.input.input-xs.input-bordered.w-full.bg-gray-900(type="text" :value="selectedElement.settings?.barColor || '#9ca3af'" @input="updateGateStyle('barColor', $event.target.value)")
          
          .grid.grid-cols-3.gap-2.mb-2
            .flex.items-center.gap-1
              label.text-gray-400 Толщ:
              input.input.input-xs.input-bordered.w-full.bg-gray-800(type="number" min="1" max="20" :value="selectedElement.settings?.barWidth || 4" @input="updateGateStyle('barWidth', Number($event.target.value))")
            .flex.items-center.gap-1
              label.text-gray-400 Шаг:
              input.input.input-xs.input-bordered.w-full.bg-gray-800(type="number" min="4" max="50" :value="selectedElement.settings?.barSpacing || 12" @input="updateGateStyle('barSpacing', Number($event.target.value))")
            .flex.items-center.gap-1
              label.text-gray-400 Прозр:
              input.input.input-xs.input-bordered.w-full.bg-gray-800(type="number" step="0.1" min="0.1" max="1" :value="selectedElement.settings?.barOpacity ?? 0.9" @input="updateGateStyle('barOpacity', Number($event.target.value))")

          template(v-if="isWicketGate")
            .grid.grid-cols-3.gap-2.mb-2
              .flex.items-center.gap-1
                label.text-gray-400 Ручка:
                input.input.input-xs.input-bordered.w-10.h-6.p-0.flex-shrink-0.bg-gray-800(type="color" :value="selectedElement.settings?.handleColor || '#d97706'" @input="updateGateStyle('handleColor', $event.target.value)")
              .flex.items-center.gap-1
                label.text-gray-400 Шир:
                input.input.input-xs.input-bordered.w-full.bg-gray-800(type="number" min="2" max="20" :value="selectedElement.settings?.handleWidth || 8" @input="updateGateStyle('handleWidth', Number($event.target.value))")
              .flex.items-center.gap-1
                label.text-gray-400 Выс:
                input.input.input-xs.input-bordered.w-full.bg-gray-800(type="number" min="4" max="40" :value="selectedElement.settings?.handleHeight || 16" @input="updateGateStyle('handleHeight', Number($event.target.value))")

          .mt-3.pt-2.border-t.border-gray-700
          .mb-2.text-gray-300.font-bold Точки траекторий
          .text-xxs.text-gray-500.mb-3 Смещение от левого верхнего угла ворот
          
          template(v-if="!selectedElement.settings?.gateType")
            .text-xxs.text-yellow-500.ml-3 ⚠️ Сначала выберите тип (Откатные или Калитка)

          template(v-if="showCarTrajectory")
            .mb-3
              .text-xxs.text-green-400.mb-1.font-bold ⬇ ВЪЕЗД АВТО
              .text-xxs.text-gray-500.mb-1.ml-3 Спавн (появление снаружи)
              .grid.grid-cols-2.gap-x-2.gap-y-1.mb-2.ml-3
                .flex.items-center.gap-1
                  span.w-10.text-xxs.text-green-400 🚗 X:
                  input.input.input-xs.input-bordered.w-full.bg-gray-900(type="number" step="1" :value="selectedElement.settings?.spawnEnterCarX || ''" @input="updatePoint('spawnEnterCar', 'x', $event)")
                .flex.items-center.gap-1
                  span.w-10.text-xxs.text-green-400 🚗 Y:
                  input.input.input-xs.input-bordered.w-full.bg-gray-900(type="number" step="1" :value="selectedElement.settings?.spawnEnterCarY || ''" @input="updatePoint('spawnEnterCar', 'y', $event)")
              .text-xxs.text-gray-500.mb-1.ml-3 Остановка (перед воротами)
              .grid.grid-cols-2.gap-x-2.gap-y-1.mb-2.ml-3
                .flex.items-center.gap-1
                  span.w-10.text-xxs.text-orange-400 🚗 X:
                  input.input.input-xs.input-bordered.w-full.bg-gray-900(type="number" step="1" :value="selectedElement.settings?.stopEnterCarX ?? ''" @input="updatePoint('stopEnterCar', 'x', $event)")
                .flex.items-center.gap-1
                  span.w-10.text-xxs.text-orange-400 🚗 Y:
                  input.input.input-xs.input-bordered.w-full.bg-gray-900(type="number" step="1" :value="selectedElement.settings?.stopEnterCarY ?? ''" @input="updatePoint('stopEnterCar', 'y', $event)")
              .text-xxs.text-gray-500.mb-1.ml-3 Движение (за воротами)
              .grid.grid-cols-2.gap-x-2.gap-y-1.mb-2.ml-3
                .flex.items-center.gap-1
                  span.w-10.text-xxs.text-yellow-400 🚗 X:
                  input.input.input-xs.input-bordered.w-full.bg-gray-900(type="number" step="1" :value="selectedElement.settings?.crossEnterCarX ?? ''" @input="updatePoint('crossEnterCar', 'x', $event)")
                .flex.items-center.gap-1
                  span.w-10.text-xxs.text-yellow-400 🚗 Y:
                  input.input.input-xs.input-bordered.w-full.bg-gray-900(type="number" step="1" :value="selectedElement.settings?.crossEnterCarY ?? ''" @input="updatePoint('crossEnterCar', 'y', $event)")
              .text-xxs.text-gray-500.mb-1.ml-3 Деспавн (уход вглубь)
              .grid.grid-cols-2.gap-x-2.gap-y-1.ml-3
                .flex.items-center.gap-1
                  span.w-10.text-xxs.text-gray-400 🚗 X:
                  input.input.input-xs.input-bordered.w-full.bg-gray-900(type="number" step="1" :value="selectedElement.settings?.despawnEnterCarX || ''" @input="updatePoint('despawnEnterCar', 'x', $event)")
                .flex.items-center.gap-1
                  span.w-10.text-xxs.text-gray-400 🚗 Y:
                  input.input.input-xs.input-bordered.w-full.bg-gray-900(type="number" step="1" :value="selectedElement.settings?.despawnEnterCarY || ''" @input="updatePoint('despawnEnterCar', 'y', $event)")
            .mb-1
              .text-xxs.text-red-400.mb-1.font-bold ⬆ ВЫЕЗД АВТО
              .text-xxs.text-gray-500.mb-1.ml-3 Спавн (появление изнутри)
              .grid.grid-cols-2.gap-x-2.gap-y-1.mb-2.ml-3
                .flex.items-center.gap-1
                  span.w-10.text-xxs.text-red-400 🚗 X:
                  input.input.input-xs.input-bordered.w-full.bg-gray-900(type="number" step="1" :value="selectedElement.settings?.spawnExitCarX || ''" @input="updatePoint('spawnExitCar', 'x', $event)")
                .flex.items-center.gap-1
                  span.w-10.text-xxs.text-red-400 🚗 Y:
                  input.input.input-xs.input-bordered.w-full.bg-gray-900(type="number" step="1" :value="selectedElement.settings?.spawnExitCarY || ''" @input="updatePoint('spawnExitCar', 'y', $event)")
              .text-xxs.text-gray-500.mb-1.ml-3 Остановка (перед воротами)
              .grid.grid-cols-2.gap-x-2.gap-y-1.mb-2.ml-3
                .flex.items-center.gap-1
                  span.w-10.text-xxs.text-pink-400 🚗 X:
                  input.input.input-xs.input-bordered.w-full.bg-gray-900(type="number" step="1" :value="selectedElement.settings?.stopExitCarX ?? ''" @input="updatePoint('stopExitCar', 'x', $event)")
                .flex.items-center.gap-1
                  span.w-10.text-xxs.text-pink-400 🚗 Y:
                  input.input.input-xs.input-bordered.w-full.bg-gray-900(type="number" step="1" :value="selectedElement.settings?.stopExitCarY ?? ''" @input="updatePoint('stopExitCar', 'y', $event)")
              .text-xxs.text-gray-500.mb-1.ml-3 Движение (за воротами)
              .grid.grid-cols-2.gap-x-2.gap-y-1.mb-2.ml-3
                .flex.items-center.gap-1
                  span.w-10.text-xxs.text-yellow-400 🚗 X:
                  input.input.input-xs.input-bordered.w-full.bg-gray-900(type="number" step="1" :value="selectedElement.settings?.crossExitCarX ?? ''" @input="updatePoint('crossExitCar', 'x', $event)")
                .flex.items-center.gap-1
                  span.w-10.text-xxs.text-yellow-400 🚗 Y:
                  input.input.input-xs.input-bordered.w-full.bg-gray-900(type="number" step="1" :value="selectedElement.settings?.crossExitCarY ?? ''" @input="updatePoint('crossExitCar', 'y', $event)")
              .text-xxs.text-gray-500.mb-1.ml-3 Деспавн (уход за экран)
              .grid.grid-cols-2.gap-x-2.gap-y-1.ml-3
                .flex.items-center.gap-1
                  span.w-10.text-xxs.text-gray-400 🚗 X:
                  input.input.input-xs.input-bordered.w-full.bg-gray-900(type="number" step="1" :value="selectedElement.settings?.despawnExitCarX || ''" @input="updatePoint('despawnExitCar', 'x', $event)")
                .flex.items-center.gap-1
                  span.w-10.text-xxs.text-gray-400 🚗 Y:
                  input.input.input-xs.input-bordered.w-full.bg-gray-900(type="number" step="1" :value="selectedElement.settings?.despawnExitCarY || ''" @input="updatePoint('despawnExitCar', 'y', $event)")

          template(v-if="showPersonTrajectory")
            .mb-3
              .text-xxs.text-green-400.mb-1.font-bold ⬇ ВХОД ПЕШЕХОДА
              .text-xxs.text-gray-500.mb-1.ml-3 Спавн (появление снаружи)
              .grid.grid-cols-2.gap-x-2.gap-y-1.mb-2.ml-3
                .flex.items-center.gap-1
                  span.w-10.text-xxs.text-green-400 👤 X:
                  input.input.input-xs.input-bordered.w-full.bg-gray-900(type="number" step="1" :value="selectedElement.settings?.spawnEnterPersonX || ''" @input="updatePoint('spawnEnterPerson', 'x', $event)")
                .flex.items-center.gap-1
                  span.w-10.text-xxs.text-green-400 👤 Y:
                  input.input.input-xs.input-bordered.w-full.bg-gray-900(type="number" step="1" :value="selectedElement.settings?.spawnEnterPersonY || ''" @input="updatePoint('spawnEnterPerson', 'y', $event)")
              .text-xxs.text-gray-500.mb-1.ml-3 Остановка (перед калиткой)
              .grid.grid-cols-2.gap-x-2.gap-y-1.mb-2.ml-3
                .flex.items-center.gap-1
                  span.w-10.text-xxs.text-cyan-400 👤 X:
                  input.input.input-xs.input-bordered.w-full.bg-gray-900(type="number" step="1" :value="selectedElement.settings?.stopEnterPersonX ?? ''" @input="updatePoint('stopEnterPerson', 'x', $event)")
                .flex.items-center.gap-1
                  span.w-10.text-xxs.text-cyan-400 👤 Y:
                  input.input.input-xs.input-bordered.w-full.bg-gray-900(type="number" step="1" :value="selectedElement.settings?.stopEnterPersonY ?? ''" @input="updatePoint('stopEnterPerson', 'y', $event)")
              .text-xxs.text-gray-500.mb-1.ml-3 Движение (за калиткой)
              .grid.grid-cols-2.gap-x-2.gap-y-1.mb-2.ml-3
                .flex.items-center.gap-1
                  span.w-10.text-xxs.text-yellow-400 👤 X:
                  input.input.input-xs.input-bordered.w-full.bg-gray-900(type="number" step="1" :value="selectedElement.settings?.crossEnterPersonX ?? ''" @input="updatePoint('crossEnterPerson', 'x', $event)")
                .flex.items-center.gap-1
                  span.w-10.text-xxs.text-yellow-400 👤 Y:
                  input.input.input-xs.input-bordered.w-full.bg-gray-900(type="number" step="1" :value="selectedElement.settings?.crossEnterPersonY ?? ''" @input="updatePoint('crossEnterPerson', 'y', $event)")
              .text-xxs.text-gray-500.mb-1.ml-3 Деспавн (уход вглубь)
              .grid.grid-cols-2.gap-x-2.gap-y-1.ml-3
                .flex.items-center.gap-1
                  span.w-10.text-xxs.text-gray-400 👤 X:
                  input.input.input-xs.input-bordered.w-full.bg-gray-900(type="number" step="1" :value="selectedElement.settings?.despawnEnterPersonX || ''" @input="updatePoint('despawnEnterPerson', 'x', $event)")
                .flex.items-center.gap-1
                  span.w-10.text-xxs.text-gray-400 👤 Y:
                  input.input.input-xs.input-bordered.w-full.bg-gray-900(type="number" step="1" :value="selectedElement.settings?.despawnEnterPersonY || ''" @input="updatePoint('despawnEnterPerson', 'y', $event)")
            .mb-1
              .text-xxs.text-red-400.mb-1.font-bold ⬆ ВЫХОД ПЕШЕХОДА
              .text-xxs.text-gray-500.mb-1.ml-3 Спавн (появление изнутри)
              .grid.grid-cols-2.gap-x-2.gap-y-1.mb-2.ml-3
                .flex.items-center.gap-1
                  span.w-10.text-xxs.text-red-400 👤 X:
                  input.input.input-xs.input-bordered.w-full.bg-gray-900(type="number" step="1" :value="selectedElement.settings?.spawnExitPersonX || ''" @input="updatePoint('spawnExitPerson', 'x', $event)")
                .flex.items-center.gap-1
                  span.w-10.text-xxs.text-red-400 👤 Y:
                  input.input.input-xs.input-bordered.w-full.bg-gray-900(type="number" step="1" :value="selectedElement.settings?.spawnExitPersonY || ''" @input="updatePoint('spawnExitPerson', 'y', $event)")
              .text-xxs.text-gray-500.mb-1.ml-3 Остановка (перед калиткой)
              .grid.grid-cols-2.gap-x-2.gap-y-1.mb-2.ml-3
                .flex.items-center.gap-1
                  span.w-10.text-xxs.text-purple-400 👤 X:
                  input.input.input-xs.input-bordered.w-full.bg-gray-900(type="number" step="1" :value="selectedElement.settings?.stopExitPersonX ?? ''" @input="updatePoint('stopExitPerson', 'x', $event)")
                .flex.items-center.gap-1
                  span.w-10.text-xxs.text-purple-400 👤 Y:
                  input.input.input-xs.input-bordered.w-full.bg-gray-900(type="number" step="1" :value="selectedElement.settings?.stopExitPersonY ?? ''" @input="updatePoint('stopExitPerson', 'y', $event)")
              .text-xxs.text-gray-500.mb-1.ml-3 Движение (за калиткой)
              .grid.grid-cols-2.gap-x-2.gap-y-1.mb-2.ml-3
                .flex.items-center.gap-1
                  span.w-10.text-xxs.text-yellow-400 👤 X:
                  input.input.input-xs.input-bordered.w-full.bg-gray-900(type="number" step="1" :value="selectedElement.settings?.crossExitPersonX ?? ''" @input="updatePoint('crossExitPerson', 'x', $event)")
                .flex.items-center.gap-1
                  span.w-10.text-xxs.text-yellow-400 👤 Y:
                  input.input.input-xs.input-bordered.w-full.bg-gray-900(type="number" step="1" :value="selectedElement.settings?.crossExitPersonY ?? ''" @input="updatePoint('crossExitPerson', 'y', $event)")
              .text-xxs.text-gray-500.mb-1.ml-3 Деспавн (уход за экран)
              .grid.grid-cols-2.gap-x-2.gap-y-1.ml-3
                .flex.items-center.gap-1
                  span.w-10.text-xxs.text-gray-400 👤 X:
                  input.input.input-xs.input-bordered.w-full.bg-gray-900(type="number" step="1" :value="selectedElement.settings?.despawnExitPersonX || ''" @input="updatePoint('despawnExitPerson', 'x', $event)")
                .flex.items-center.gap-1
                  span.w-10.text-xxs.text-gray-400 👤 Y:
                  input.input.input-xs.input-bordered.w-full.bg-gray-900(type="number" step="1" :value="selectedElement.settings?.despawnExitPersonY || ''" @input="updatePoint('despawnExitPerson', 'y', $event)")

    //- ==========================================
    //- ИНСПЕКТОР ПАНЕЛИ
    //- ==========================================
    template(v-else-if="selectedPanel && !selectedControl")
      .mb-2.text-gray-300.font-bold Настройки Панели
      .grid.grid-cols-2.gap-2.mb-2
        .flex.col-span-2
          .mb-1.text-gray-400 Заголовок:
          input.input.input-xs.input-bordered.w-full.bg-gray-800(type="text" :value="selectedPanel.title" @input="updatePanel('title', $event.target.value)")
        .flex.items-center.gap-1
          label.text-gray-400 Z-уровень:
          input.input.input-xs.input-bordered.w-full.bg-gray-800(type="number" :value="selectedPanel.zIndex || 100" @input="updatePanel('zIndex', Number($event.target.value))")
        .flex.items-center.gap-1
          label.text-gray-400 Фон:
          input.input.input-xs.input-bordered.w-full.h-6.p-0.bg-gray-800(type="color" :value="selectedPanel.bgColor || '#2d3748'" @input="updatePanel('bgColor', $event.target.value)")
        .flex.items-center.gap-1
          label.text-gray-400 Рамка:
          input.input.input-xs.input-bordered.w-full.h-6.p-0.bg-gray-800(type="color" :value="selectedPanel.borderColor || '#4a5568'" @input="updatePanel('borderColor', $event.target.value)")
      .mb-2.text-gray-500 Примечание: Для изменения размера перетаскивайте углы панели на холсте.

    //- ==========================================
    //- ВЫБРАН КОНТРОЛ (КНОПКА НА ПАНЕЛИ)
    //- ==========================================
    template(v-else-if="selectedControl")
      .mb-2
        .grid.grid-cols-2.gap-2
          .flex
            .mb-1.text-gray-400 Тип:
            input.input.input-xs.input-bordered.bg-gray-800(type="text" :value="selectedControl.type" disabled)
          .flex
            .mb-1.text-gray-400 ID:
            input.input.input-xs.input-bordered.bg-gray-800(type="text" :value="selectedControl.id" disabled)
            
      // === НОВЫЙ БЛОК: ГОРЯЧАЯ КЛАВИША ===
      .mb-2.text-gray-400 Управление:
      .flex.items-center.gap-2.mb-3
        span.text-gray-400.w-28 Горячая клавиша:
        button.btn.btn-xs.border.border-gray-600.w-28.h-6.flex.items-center.justify-center.text-center.font-mono(
          :class="isListeningHotkey ? 'border-amber-500 text-amber-400 bg-amber-500/10 animate-pulse' : 'hover:border-gray-400'"
          @click="startListeningHotkey"
          @dblclick.prevent
        )
          span(v-if="isListeningHotkey") Нажмите...
          span(v-else-if="selectedControl?.settings?.hotkey") {{ selectedControl.settings.hotkey }}
          span(v-else.text-gray-600) Не задана
        button.btn.btn-ghost.btn-xs.text-red-400.w-6.h-6.p-0(
          v-if="selectedControl?.settings?.hotkey && !isListeningHotkey"
          @click="clearHotkey"
          title="Сбросить"
        ) ✕
      // === КОНЕЦ БЛОКА ===

      .mb-2.text-gray-400 Внешний вид:
      .grid.grid-cols-2.gap-2.mb-2
        .flex.items-center
          label.text-gray-400 Цвет:
          input.input.input-xs.input-bordered.w-full.bg-gray-800(type="color" v-model="controlColor")
        .flex.items-center
          label.text-gray-400 Ширина:
          input.input.input-xs.input-bordered.w-full.bg-gray-800(type="number" v-model="controlWidth" min="20")
        .flex.items-center
          label.text-gray-400 Высота:
          input.input.input-xs.input-bordered.w-full.bg-gray-800(type="number" v-model="controlHeight" min="20")
        .flex.items-center
          label.text-gray-400 Скругление:
          input.input.input-xs.input-bordered.w-full.bg-gray-800(type="number" v-model="controlBorderRadius" min="0" max="50")
      .mb-2.text-gray-400 Надпись:
      .grid.grid-cols-2.gap-2.mb-2
        .flex.items-center
          label.text-gray-400 Текст:
          input.input.input-xs.input-bordered.w-full.bg-gray-800(type="text" v-model="controlLabel")
        .flex.items-center
          .flex.items-center
          label.text-gray-400 Положение:
          select.select.select-xs.select-bordered.bg-gray-800(v-model="controlLabelPosition")
            option(value="inside") Внутри кнопки
            option(value="bottom") Под кнопкой
        .flex.items-center
          label.text-gray-400 Шрифт:
          input.input.input-xs.input-bordered.w-full.bg-gray-800(type="number" v-model="controlFontSize" min="8" max="24")
        .flex.items-center
          label.text-gray-400 Цвет:
          input.input.input-xs.input-bordered.w-full.bg-gray-800(type="color" v-model="controlTextColor")
        .flex.items-center
          label.text-gray-400 Выравн.:
          select.select.select-xs.select-bordered.bg-gray-800(v-model="controlLabelAlign")
            option(value="left") По левому краю
            option(value="center") По центру
            option(value="right") По правому краю
        .flex.items-center
          label.text-gray-400 Фон:
          input.input.input-xs.input-bordered.w-full.bg-gray-800(type="text" v-model="controlLabelBg" placeholder="transparent или #000")
        .flex.items-center
          label.text-gray-400 Padding:
          input.input.input-xs.input-bordered.w-full.bg-gray-800(type="text" v-model="controlLabelPadding" placeholder="2px 4px")
        .flex.items-center
          label.text-gray-400 Margin:
          input.input.input-xs.input-bordered.w-full.bg-gray-800(type="number" v-model="controlLabelMarginTop" min="0" max="20")
      .mb-2.text-gray-400 Управление:
      .flex.items-center.gap-2.mb-2
        span.text-gray-400 Цель:
        select.select.select-xs.select-bordered.bg-gray-800.flex-1(v-model="controlTargetGateId")
          option(value="") — Не выбрано —
          option(v-for="gate in availableGates" :key="gate.id" :value="gate.id") {{ getGateDisplayName(gate) }}
      .flex.justify-end.mt-2
        button.btn.btn-xs.btn-error(@click="$emit('delete-control', { pId: selectedControlPanelId, cId: selectedControl.id })") Удалить

    //- ==========================================
    //- НАСТРОЙКИ СЦЕНЫ
    //- ==========================================
    template(v-else)
      .mb-3.text-gray-400 Настройки Сцены
      .grid.grid-cols-2.gap-2.mb-2
        .flex.items-center.gap-1
          label.text-gray-400 ширина:
          input.input.input-xs.input-bordered.w-16.text-center.bg-gray-800(type="number" :value="settings.width" @input="$emit('update:settings', { key: 'width', val: Number($event.target.value) })")
          span.text-gray-400 px
        .flex.items-center.gap-1
          label.text-gray-400 высота:
          input.input.input-xs.input-bordered.w-16.text-center.bg-gray-800(type="number" :value="settings.height" @input="$emit('update:settings', { key: 'height', val: Number($event.target.value) })")
          span.text-gray-400 px
      .flex.items-center.gap-2.mb-3
        .text-gray-400 Цвет фона:
        input.input.input-xs.input-bordered.flex-1.h-6.p-0.bg-gray-800(type="color" :value="settings.bgColor" @input="$emit('update:settings', { key: 'bgColor', val: $event.target.value })")

      .mt-3.pt-3.border-t.border-gray-700
      .mb-2.text-gray-300.font-bold Трафик (Симуляция)
      .flex.items-center.gap-2.mb-3
        .text-gray-400.w-28 Макс. агентов:
        input.input.input-xs.input-bordered.w-20.text-center.bg-gray-800(type="number" min="1" max="100" :value="settings.traffic?.maxAgents ?? 4" @input="updateTraffic('maxAgents', Number($event.target.value))")
        
      .text-xxs.text-gray-500.mb-1.ml-1 Интервал спавна людей (сек)
      .grid.grid-cols-2.gap-2.mb-3.ml-1
        .flex.items-center.gap-1
          label.text-gray-400 От:
          input.input.input-xs.input-bordered.w-full.bg-gray-800(type="number" min="1" :value="settings.traffic?.spawnIntervalMin || 10" @input="updateTraffic('spawnIntervalMin', Number($event.target.value))")
        .flex.items-center.gap-1
          label.text-gray-400 До:
          input.input.input-xs.input-bordered.w-full.bg-gray-800(type="number" min="1" :value="settings.traffic?.spawnIntervalMax || 30" @input="updateTraffic('spawnIntervalMax', Number($event.target.value))")

      .text-xxs.text-gray-500.mb-1.ml-1 Интервал спавна авто (сек)
      .grid.grid-cols-2.gap-2.mb-1.ml-1
        .flex.items-center.gap-1
          label.text-gray-400 От:
          input.input.input-xs.input-bordered.w-full.bg-gray-800(type="number" min="1" :value="settings.traffic?.carSpawnIntervalMin || 5" @input="updateTraffic('carSpawnIntervalMin', Number($event.target.value))")
        .flex.items-center.gap-1
          label.text-gray-400 До:
          input.input.input-xs.input-bordered.w-full.bg-gray-800(type="number" min="1" :value="settings.traffic?.carSpawnIntervalMax || 15" @input="updateTraffic('carSpawnIntervalMax', Number($event.target.value))")

      .text-xxs.text-gray-500.mb-1.mt-2.ml-1 Размер машин (пиксели)
      .grid.grid-cols-2.gap-2.mb-1.ml-1
        .flex.items-center.gap-1
          label.text-gray-400 Ширина:
          input.input.input-xs.input-bordered.w-full.bg-gray-800(type="number" min="50" :value="settings.traffic?.carWidth || 160" @input="updateTraffic('carWidth', Number($event.target.value))")
        .flex.items-center.gap-1
          label.text-gray-400 Высота:
          input.input.input-xs.input-bordered.w-full.bg-gray-800(type="number" min="30" :value="settings.traffic?.carHeight")
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { SceneElement, SceneSettings, Control, Panel } from '../../types/scene'

// ИСПРАВЛЕНИЕ: Используем withDefaults, чтобы приложение не крашилось,
// если родитель временно не передал пропс panels
const props = withDefaults(defineProps<{
  selectedElement: SceneElement | null
  selectedControl?: Control | null
  selectedControlPanelId?: string | null
  selectedPanelId?: string | null
  panels?: Panel[]
  settings: SceneSettings
  sceneElements: SceneElement[]
}>(), {
  panels: () => []
})

const emit = defineEmits([
  'update:element', 'update:settings', 'delete:element',
  'update:control', 'delete-control',
  'update:panel', 'delete-panel', 'execute-control'
])

// ==========================================
// ЛОГИКА НАЗНАЧЕНИЯ ГОРЯЧИХ КЛАВИШ
// ==========================================
const isListeningHotkey = ref(false)

const startListeningHotkey = () => {
  isListeningHotkey.value = !isListeningHotkey.value
}

const clearHotkey = () => {
  if (!props.selectedControl || !props.selectedControlPanelId) return
  const newSettings = { ...props.selectedControl.settings }
  delete newSettings.hotkey
  emit('update:control', props.selectedControlPanelId, props.selectedControl.id, { settings: newSettings })
}

const formatHotkey = (e: KeyboardEvent): string | null => {
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')

  let key = e.key
  if (key === ' ') key = 'Space'
  else if (key.length === 1) key = key.toUpperCase()

  parts.push(key)
  return parts.join(' + ')
}

const handleGlobalKeyDown = (e: KeyboardEvent) => {
  const hotkeyStr = formatHotkey(e)
  
  // ЕСЛИ МЫ ЗАПИСЫВАЕМ НОВУЮ КЛАВИШУ — ПЕРЕХВАТЫВАЕМ
  if (isListeningHotkey.value) {
    e.preventDefault()
    e.stopImmediatePropagation() 

    if (e.key === 'Escape') {
      isListeningHotkey.value = false
      return
    }

    if (hotkeyStr) {
      updateControlSetting('hotkey', hotkeyStr)
      isListeningHotkey.value = false
    }
    return
  }
}

// Используем { capture: true }, чтобы наш слушатель срабатывал ДО глобальных слушателей приложения
onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeyDown, { capture: true })
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true })
})
// ==========================================

// --- Вычисляемые свойства ---
const selectedPanel = computed(() => props.panels?.find(p => p.id === props.selectedPanelId) || null)

const isGateElement = computed(() => props.selectedElement?.category === 'gate' || props.selectedElement?.type === 'gate')
const isSlidingGate = computed(() => props.selectedElement?.settings?.gateType === 'sliding')
const isWicketGate = computed(() => props.selectedElement?.settings?.gateType === 'wicket')

const showPersonTrajectory = computed(() => isWicketGate.value)
const showCarTrajectory = computed(() => isSlidingGate.value)

// --- Для элементов сцены ---
const aspectRatioLocked = ref(false)
let currentRatio: number | null = null

const toggleLock = () => {
  aspectRatioLocked.value = !aspectRatioLocked.value
  if (aspectRatioLocked.value && props.selectedElement) {
    const w = props.selectedElement.width
    const h = props.selectedElement.height
    currentRatio = (h > 0) ? w / h : 1
  } else currentRatio = null
}

const onWidthChange = (e: Event) => {
  if (!props.selectedElement) return
  const newWidth = Number((e.target as HTMLInputElement).value)
  const changes: any = { width: newWidth }
  if (aspectRatioLocked.value && currentRatio !== null) {
    let newHeight = Math.round(newWidth / currentRatio)
    if (newHeight < 1) newHeight = 1
    changes.height = newHeight
    currentRatio = newWidth / newHeight
  }
  emit('update:element', props.selectedElement.id, changes)
}

const onHeightChange = (e: Event) => {
  if (!props.selectedElement) return
  const newHeight = Number((e.target as HTMLInputElement).value)
  const changes: any = { height: newHeight }
  if (aspectRatioLocked.value && currentRatio !== null) {
    let newWidth = Math.round(newHeight * currentRatio)
    if (newWidth < 1) newWidth = 1
    changes.width = newWidth
    currentRatio = newWidth / newHeight
  }
  emit('update:element', props.selectedElement.id, changes)
}

const handleInput = (key: string, value: any) => {
  if (props.selectedElement) emit('update:element', props.selectedElement.id, { [key]: value })
}

// Управление Z-уровнем
const handleZIndex = (step: number) => {
  if (!props.selectedElement) return
  const newZ = (props.selectedElement.zIndex || 0) + step
  emit('update:element', props.selectedElement.id, { zIndex: newZ })
}

// --- Логика ворот ---
const updateGateType = (type: string) => {
  if (props.selectedElement) emit('update:element', props.selectedElement.id, { settings: { ...props.selectedElement.settings, gateType: type } })
}

const toggleGateOpen = () => {
  if (props.selectedElement) {
    const isOpen = !props.selectedElement.settings?.isOpen
    emit('update:element', props.selectedElement.id, { settings: { ...props.selectedElement.settings, isOpen } })
  }
}

const updateGateDuration = (type: 'open' | 'close', duration: number) => {
  if (!props.selectedElement) return
  const settings = { ...props.selectedElement.settings }
  if (type === 'open') settings.openDuration = duration
  else settings.closeDuration = duration
  emit('update:element', props.selectedElement.id, { settings })
}

const updateGateStyle = (key: string, value: any) => {
  if (!props.selectedElement) return
  const settings = { ...props.selectedElement.settings, [key]: value }
  emit('update:element', props.selectedElement.id, { settings })
}

const updatePoint = (prefix: string, axis: 'x' | 'y', e: Event) => {
  if (!props.selectedElement) return
  const rawValue = (e.target as HTMLInputElement).value
  const settings = { ...props.selectedElement.settings }
  const key = `${prefix}${axis.toUpperCase()}`
  
  if (rawValue === '' || rawValue === null) {
    delete settings[key]
  } else {
    settings[key] = Number(rawValue)
  }
  
  emit('update:element', props.selectedElement.id, { settings })
}

// --- Логика панели ---
const updatePanel = (key: string, value: any) => {
  if (!props.selectedPanelId) return
  emit('update:panel', props.selectedPanelId, { [key]: value })
}

// --- Логика контролов ---
const controlLabel = computed({ get: () => props.selectedControl?.settings?.label || '', set: (val) => updateControlSetting('label', val) })
const controlColor = computed({ get: () => props.selectedControl?.settings?.color || '#3b82f6', set: (val) => updateControlSetting('color', val) })
const controlWidth = computed({ get: () => props.selectedControl?.settings?.width || 60, set: (val) => updateControlSetting('width', Number(val)) })
const controlHeight = computed({ get: () => props.selectedControl?.settings?.height || 40, set: (val) => updateControlSetting('height', Number(val)) })
const controlBorderRadius = computed({ get: () => props.selectedControl?.settings?.borderRadius || 4, set: (val) => updateControlSetting('borderRadius', Number(val)) })
const controlTargetGateId = computed({ get: () => props.selectedControl?.settings?.targetGateId || '', set: (val) => updateControlSetting('targetGateId', val || undefined) })
const controlLabelPosition = computed({ get: () => props.selectedControl?.settings?.labelPosition || 'inside', set: (val) => updateControlSetting('labelPosition', val) })
const controlFontSize = computed({ get: () => props.selectedControl?.settings?.fontSize || 10, set: (val) => updateControlSetting('fontSize', Number(val)) })
const controlTextColor = computed({ get: () => props.selectedControl?.settings?.textColor || '#ffffff', set: (val) => updateControlSetting('textColor', val) })
const controlLabelAlign = computed({ get: () => props.selectedControl?.settings?.labelAlign || 'center', set: (val) => updateControlSetting('labelAlign', val) })
const controlLabelBg = computed({ get: () => props.selectedControl?.settings?.labelBg || 'transparent', set: (val) => updateControlSetting('labelBg', val) })
const controlLabelPadding = computed({ get: () => props.selectedControl?.settings?.labelPadding || '2px 4px', set: (val) => updateControlSetting('labelPadding', val) })
const controlLabelMarginTop = computed({ get: () => props.selectedControl?.settings?.labelMarginTop || 4, set: (val) => updateControlSetting('labelMarginTop', Number(val)) })

const updateControlSetting = (key: string, value: any) => {
  if (!props.selectedControl || !props.selectedControlPanelId) return
  const newSettings = { ...props.selectedControl.settings, [key]: value }
  emit('update:control', props.selectedControlPanelId, props.selectedControl.id, { settings: newSettings })
}

// --- Логика сцены ---
const updateTraffic = (key: string, value: number) => {
  emit('update:settings', { key: `traffic.${key}`, val: value })
}

const availableGates = computed(() => props.sceneElements.filter(el => el.category === 'gate' || el.category === 'barrier' || el.type === 'gate'))

const getGateDisplayName = (gate: SceneElement) => {
  let typeName = gate.settings?.gateType === 'wicket' ? 'Калитка' : 'Ворота'
  if (gate.name) return `${typeName}: ${gate.name}`
  return `${typeName} (${gate.id.slice(-6)})`
}
</script>