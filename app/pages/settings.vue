<!-- app/pages/settings.vue -->
<template lang="pug">
.settings-page.flex.flex-col.h-full
  //- Шапка
  .flex-none.p-4.border-b.bg-base-100(class="border-base-300")
    h2.text-2xl.font-bold ⚙️ Настройки системы

  //- Основной контент
  .flex-1.overflow-y-auto.p-4.relative(class="bg-base-300")
    .tabs.mb-4.bg-base-100.tabs-boxed
      button.tab(
        v-for="tab in tabs"
        :key="tab.key"
        :class="{ 'tab-active': activeTab === tab.key }"
        @click="activeTab = tab.key"
      ) {{ tab.label }}

    component(
      :is="currentComponent"
    )

    //- Блок действий (сохранение/импорт/экспорт) – общий для всех вкладок
    .sticky.bottom-0.left-0.right-0.p-4.bg-base-300.z-10
      button.btn.btn-block.btn-primary(@click="saveSettings") 💾 Сохранить изменения
      .divider Резерв
      .flex.gap-2
        button.btn.rounded-md.btn-outline.border-2.border-secondary(@click="handleExport") 📥 Скачать
        label.btn.rounded-lg.btn-outline.border-2.border-secondary
          | 📤 Загрузить
          input.hidden(type="file" accept=".json" @change="handleImport")
        button.btn.rounded-md.btn-error(@click="clearAllData") 🗑 Очистить
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useDatabase } from '../composables/useDatabase'
import { useConfig } from '../composables/useConfig'
import SettingsUi from '~/components/settings/SettingsUi.vue'
import SettingsLabels from '~/components/settings/SettingsLabels.vue'
import SettingsColumns from '~/components/settings/SettingsColumns.vue'
import SettingsButtons from '~/components/settings/SettingsButtons.vue'
import SettingsPlaces from '~/components/settings/SettingsPlaces.vue'
import SettingsSimulator from '~/components/settings/SettingsSimulator.vue'
import SettingsGenerator from '~/components/settings/SettingsGenerator.vue'

definePageMeta({ title: 'Настройки' })

const { exportDB, importDB } = useDatabase()
const configStore = useConfig()

const activeTab = ref('ui')
const tabs = [
  { key: 'ui', label: 'Интерфейс' },
  { key: 'labels', label: 'Названия' },
  { key: 'columns', label: 'Поля журнала' },
  { key: 'buttons', label: 'Кнопки' },
  { key: 'places', label: 'Места' },
  { key: 'simulator', label: 'Симулятор' },
  { key: 'generator', label: 'Генератор' },
]

const componentsMap: Record<string, any> = {
  ui: SettingsUi,
  labels: SettingsLabels,
  columns: SettingsColumns,
  buttons: SettingsButtons,
  places: SettingsPlaces,
  simulator: SettingsSimulator,
  generator: SettingsGenerator,
}
const currentComponent = computed(() => componentsMap[activeTab.value])

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

onMounted(async () => {
  await configStore.loadConfig()
})
</script>