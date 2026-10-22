<!-- app/pages/settings.vue -->
<!-- Назначение: настройки системы — вкладки конфигурации, резервные копии.
    [UI/UX Фаза 1] UiPageHeader с описанием; Lucide-иконки кнопок;
    alert/confirm -> тосты/ConfirmDialog; перезагрузка с задержкой,
    чтобы тост успели прочитать.
    [FIX] clearAllData удаляла несуществующую БД 'SecurityJournalDB' —
    реальное имя 'KppDatabase'; плюс destroyDb() перед удалением:
    IndexedDB не удаляет БД, пока открыты соединения (delete висел молча). -->
<template lang="pug">
.settings-page.flex.flex-col.h-full
  //- Шапка страницы: назначение экрана
  .flex-none.px-4.pt-3.pb-3.bg-base-100(
    class="border-base-300 border-b"
  )
    UiPageHeader(
      title="Настройки"
      description="Поведение интерфейса, справочники, симулятор и оплата труда. Изменения применяются сразу после сохранения."
    )

  //- Основной контент
  .flex-1.overflow-y-auto.p-4.relative(class="bg-base-300")
    .tabs.mb-4.bg-base-100.tabs-boxed
      button.tab(
        v-for="tab in tabs"
        :key="tab.key"
        :class="{ 'tab-active': activeTab === tab.key }"
        @click="activeTab = tab.key"
      ) {{ tab.label }}

    component(:is="currentComponent")

    //- Блок действий — общий для всех вкладок
    .sticky.bottom-0.left-0.right-0.p-4.bg-base-300.z-10
      button.btn.btn-block.btn-primary(@click="saveSettings")
        Save.h-4.w-4.mr-1
        | Сохранить изменения
      .divider Резерв
      .flex.gap-2
        button.btn.rounded-md.btn-outline.border-2.border-secondary(@click="handleExport")
          Download.h-4.w-4.mr-1
          | Скачать
        label.btn.rounded-lg.btn-outline.border-2.border-secondary
          Upload.h-4.w-4.mr-1
          | Загрузить
          input.hidden(type="file" accept=".json" @change="handleImport")
        button.btn.rounded-md.btn-error(@click="clearAllData")
          Trash2.h-4.w-4.mr-1
          | Очистить
        button.btn.rounded-md.btn-ghost(@click="showTour")
          HelpCircle.h-4.w-4.mr-1
          | Знакомство с программой
</template>

<script setup lang="ts">
// app/pages/settings.vue — script
// [MIGRATION] lucide-vue-next -> @lucide/vue
import { ref, computed, onMounted } from 'vue'
// [UI/UX] Lucide: кнопки действий
import { Save, Download, Upload, Trash2, HelpCircle } from '@lucide/vue'
import { useDatabase } from '../composables/useDatabase'
import { useConfig } from '../composables/useConfig'
import { usePayroll } from '~/composables/usePayroll'
import { useToast } from '~/composables/useToast'
import { useConfirm } from '~/composables/useConfirm'
import { useOnboarding } from '~/composables/useOnboarding'
import SettingsUi from '~/components/settings/SettingsUi.vue'
import SettingsLabels from '~/components/settings/SettingsLabels.vue'
import SettingsColumns from '~/components/settings/SettingsColumns.vue'
import SettingsButtons from '~/components/settings/SettingsButtons.vue'
import SettingsPlaces from '~/components/settings/SettingsPlaces.vue'
import SettingsSimulator from '~/components/settings/SettingsSimulator.vue'
import SettingsPayroll from '~/components/settings/SettingsPayroll.vue'
import SettingsGenerator from '~/components/settings/SettingsGenerator.vue'

definePageMeta({ title: 'Настройки' })

const { exportDB, importDB, destroyDb } = useDatabase()
const configStore = useConfig()
// [PAYROLL] Тарифы живут отдельной записью 'payroll_config', не в app_config —
// поэтому общая кнопка сохранения обязана писать и их вручную
const { saveConfig: savePayrollConfig, isInitialized: payrollReady } = usePayroll()
const toast = useToast()
const { confirmDialog } = useConfirm()
const { show: showTour } = useOnboarding()

const activeTab = ref('ui')
const tabs = [
  { key: 'ui', label: 'Интерфейс' },
  { key: 'labels', label: 'Названия' },
  { key: 'columns', label: 'Поля журнала' },
  { key: 'buttons', label: 'Кнопки' },
  { key: 'places', label: 'Места' },
  { key: 'simulator', label: 'Симулятор' },
  { key: 'payroll', label: 'Оплата' },
  { key: 'generator', label: 'Генератор' },
]

const componentsMap: Record<string, any> = {
  ui: SettingsUi,
  labels: SettingsLabels,
  columns: SettingsColumns,
  buttons: SettingsButtons,
  places: SettingsPlaces,
  simulator: SettingsSimulator,
  payroll: SettingsPayroll,
  generator: SettingsGenerator,
}
const currentComponent = computed(() => componentsMap[activeTab.value])

// [UI/UX] alert -> тост; reload с задержкой, чтобы тост успели прочитать
const saveSettings = async () => {
  await configStore.saveConfig()
  // [PAYROLL] Guard по isInitialized: до init() движка в памяти дефолтный
  // конфиг — записать его значило бы затереть пользовательские тарифы
  if (payrollReady.value) await savePayrollConfig()
  // [№15-UX] живое применение: useConfig — реактивный синглтон, страницы
  // читают его computed-ами. Reload() больше не нужен; разрушительные
  // операции (импорт базы, очистка) по-прежнему перезагружают страницу.
  toast.success('Настройки сохранены и применены')
}

const handleExport = async () => {
  await exportDB()
  toast.success('Резервная копия скачана')
}

const handleImport = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  // [UI/UX] нативный confirm -> ConfirmDialog
  const ok = await confirmDialog({
    title: 'Заменить все данные?',
    message: 'Текущие записи (люди, журнал, смены, сцены) будут заменены содержимым файла. Действие необратимо.',
    confirmLabel: 'Заменить',
    danger: true
  })
  if (!ok) {
    ;(e.target as HTMLInputElement).value = ''
    return
  }
  try {
    await importDB(file)
    toast.success('База восстановлена из файла — перезагрузка...')
    setTimeout(() => window.location.reload(), 900)
  } catch (err: any) {
    console.error('[Settings] Import error:', err)
    toast.error('Ошибка импорта: файл повреждён или не является резервной копией')
  }
  // Сброс input: тот же файл можно выбрать повторно
  ;(e.target as HTMLInputElement).value = ''
}

const clearAllData = async () => {
  // [UI/UX] нативный confirm -> ConfirmDialog
  const ok = await confirmDialog({
    title: 'Удалить всю базу?',
    message: 'Люди, транспорт, журнал, смены и сцены будут удалены безвозвратно. Сначала скачайте резервную копию.',
    confirmLabel: 'Удалить всё',
    danger: true
  })
  if (!ok) return
  // [FIX] было deleteDatabase('SecurityJournalDB') — такой базы нет.
  // Реальная БД — 'KppDatabase'. destroyDb() обязателен: IndexedDB
  // не удаляет БД при открытых соединениях.
  destroyDb()
  indexedDB.deleteDatabase('KppDatabase')
  toast.success('База удалена — перезагрузка...')
  setTimeout(() => window.location.reload(), 900)
}

onMounted(async () => {
  await configStore.loadConfig()
})
</script>