// components/editor/EditorToolbar.vue
<!-- Панель инструментов редактора.
    Содержит название сцены, меню файла (БД и Импорт), сохранение и запуск.
-->

<template lang="pug">
header.flex.items-center.justify-between.flex-shrink-0.h-10.p-2.border-b.border-gray-700.bg-gray-800
  //- Левая часть: Название и выход
  .flex.items-center.gap-2
    h1.text-lg.font-bold 🎨 Редактор
    input.input.input-sm.w-40.h-6.text-xs.bg-gray-700.border-gray-600(
      :value="name"
      placeholder="Имя сцены"
      @input="handleInput($event)"
    )
    button.btn.btn-sm.btn-ghost(
      @click="$emit('exit')"
    ) ← Выход

  //- Правая часть: Меню и действия
  .flex.gap-1
    //- Меню "Файл"
    .dropdown.dropdown-bottom
      label.btn.btn-sm.btn-outline.h-8.min-h-0.border-none(
        tabindex="0"
        class="hover:bg-gray-700"
      ) 📂 Файл
      //- Фикс прозрачности: явный фон и граница
      ul.dropdown-content.z-30.menu.p-2.shadow-xl.rounded-box.w-52.bg-gray-800.border.border-gray-700.text-white
        li
          button.w-full.text-left(
            @click="$emit('open')"
          ) 📂 Открыть (База)
        li
          button.w-full.text-left(
            @click="triggerImport"
          ) 📥 Импорт (Файл)
          //- Скрытый инпут для загрузки файлов
          input.hidden(
            type="file"
            accept=".json"
            ref="importInput"
            @change="handleFileChange"
          )

    //- Меню "Сохранить"
    .dropdown.dropdown-bottom
      label.btn.btn-sm.btn-primary.h-8.min-h-0.border-none(
        tabindex="0"
      ) 💾 Сохранить
      //- Фикс прозрачности
      ul.dropdown-content.z-30.menu.p-2.shadow-xl.rounded-box.w-52.bg-gray-800.border.border-gray-700.text-white
        li
          button.w-full.text-left(
            @click="$emit('save')"
          ) 💾 Сохранить
        li
          button.w-full.text-left(
            @click="$emit('save-as')"
          ) 📝 Сохранить как...
        li
          button.w-full.text-left(
            @click="$emit('export')"
          ) 📤 Экспорт

    //- Кнопка запуска
    button.btn.btn-sm.btn-success.h-8.min-h-0.gap-1.border-none(
      @click="$emit('run')"
    )
      span ▶ Играть
</template>

<script setup lang="ts">
// components/editor/EditorToolbar.vue
// Логика тулбара: обработка ввода названия и файлов.

import { ref } from 'vue'

// --- Props ---
defineProps<{
  name: string
}>()

// --- Emits ---
const emit = defineEmits<{
  (e: 'update:name', value: string): void
  (e: 'exit'): void
  (e: 'open'): void       // Открытие из базы данных
  (e: 'import', event: Event): void // Импорт из файла
  (e: 'save'): void
  (e: 'save-as'): void
  (e: 'export'): void
  (e: 'run'): void        // Запуск симуляции
}>()

// --- State ---
const importInput = ref<HTMLInputElement | null>(null)

// --- Methods ---
const triggerImport = () => {
  importInput.value?.click()
}

const handleFileChange = (e: Event) => {
  emit('import', e)
  // Сброс значения для повторной загрузки того же файла
  if (importInput.value) importInput.value.value = ''
}

const handleInput = (e: Event) => {
  const target = e.target as HTMLInputElement
  emit('update:name', target.value)
}
</script>