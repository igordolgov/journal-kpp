<!-- app/pages/reports.vue -->
<!-- Страница премиальной аналитики.
    Интерфейс разработан для размещения на одном экране (100vh) без скролла.
    Используется сетка из 12 колонок, жесткое управление высотами через flex-1/min-h-0,
    градиентный фон для глубины и улучшенные карточки с тенями.
-->

<template lang="pug">
.reports-page.flex.flex-col.w-full.overflow-hidden.gap-0(
  class="h-[calc(100dvh-60px)] bg-gradient-to-br from-base-200 to-base-300"
)
  //- ШАПКА: НАЗВАНИЕ И ПЕРИОД
  header.flex.justify-between.items-end.p-4.pb-2.flex-none
    h2.text-3xl.font-bold.tracking-tight.text-base-content
      | 📊 Аналитика КПП
    select.select.select-bordered.select-sm.bg-base-100.shadow(
      v-model="period"
    )
      option(value="day") Сегодня
      option(value="week") Неделя
      option(value="month") Месяц

  //- КАРТОЧКИ СТАТИСТИКИ (Компактные, в один ряд)
  .grid.grid-cols-5.gap-3.px-4.pb-3.flex-none
    .stat.shadow-xl.bg-base-100.p-3.rounded-xl.border.border-base-300
      .stat-title.text-xs.opacity-60
        | 📝 Записей
      .stat-value.text-2xl.font-bold.text-primary {{ stats.totalEntries }}
    
    .stat.shadow-xl.bg-base-100.p-3.rounded-xl.border.border-base-300
      .stat-title.text-xs.opacity-60
        | 🚶 На выезде
      .stat-value.text-2xl.font-bold.text-warning {{ stats.residentsOut }}
    
    .stat.shadow-xl.bg-base-100.p-3.rounded-xl.border.border-base-300
      .stat-title.text-xs.opacity-60
        | 🤝 Гостей
      .stat-value.text-2xl.font-bold.text-success {{ stats.guestsIn }}
    
    .stat.shadow-xl.bg-base-100.p-3.rounded-xl.border.border-base-300
      .stat-title.text-xs.opacity-60
        | ⏱ В среднем
      .stat-value.text-2xl.font-bold.text-accent {{ stats.avgDuration }}
    
    .stat.shadow-xl.bg-base-100.p-3.rounded-xl.border.border-base-300
      .stat-title.text-xs.opacity-60
        | 🔥 Пик
      .stat-value.text-2xl.font-bold.text-error {{ stats.peakHour }}

  //- ОСНОВНОЙ КОНТЕНТ (Графики занимают 100% оставшейся высоты)
  ClientOnly
    main.grid.grid-cols-12.gap-3.px-4.pb-4.flex-1.min-h-0
      //- ЛЕВАЯ КОЛОНКА (Аудитория + Топ отсутствующих)
      .col-span-12.flex.flex-col.gap-3(
        class="md:col-span-3"
      )
        .card.shadow-xl.bg-base-100.min-h-0.border.border-base-300(
          class="flex-[2]"
        )
          .card-body.p-3.gap-2
            h4.text-xs.font-bold.text-base-content.opacity-70.uppercase.tracking-wider
              | Текущая аудитория
            .relative.w-full.h-full
              DoughnutChart(
                :data="audienceChartData"
                :options="doughnutOptions"
              )
        
        .card.shadow-xl.bg-base-100.min-h-0.border.border-base-300(
          class="flex-[1]"
        )
          .card-body.p-3.gap-2.overflow-hidden
            h4.text-xs.font-bold.text-base-content.opacity-70.uppercase.tracking-wider
              | 🚶 Отсутствуют
            .flex.flex-col.gap-1.overflow-y-auto.custom-scrollbar
              //- ИСПРАВЛЕНО: p-1.5 перенесено в class="", так как точка ломает Pug
              .flex.justify-between.items-center.rounded-lg(
                v-for="p in topAbsentPeople"
                :key="p.id"
                class="p-1.5 hover:bg-base-200 transition-colors"
              )
                span.text-sm.font-medium.truncate {{ p.fio }}
                span.text-xs.opacity-50.flex-none {{ formatTime(p.timestamp_out) }}
              .text-center.text-xs.opacity-40.py-2(
                v-if="!topAbsentPeople.length"
              )
                | Все дома 👍

      //- ЦЕНТРАЛЬНАЯ КОЛОНКА (Хроника КПП)
      .col-span-12.flex.flex-col(
        class="md:col-span-6"
      )
        .card.shadow-xl.bg-base-100.flex-1.min-h-0.border.border-base-300
          .card-body.p-4.h-full.flex.flex-col.gap-2
            h4.text-xs.font-bold.text-base-content.opacity-70.uppercase.tracking-wider
              | Хроника КПП
            .relative.w-full.flex-1.min-h-0
              LineChart(
                :data="timelineChartData"
                :options="timelineChartOptions"
              )

      //- ПРАВАЯ КОЛОНКА (Пиковые часы + Места + Транспорт)
      .col-span-12.flex.flex-col.gap-3(
        class="md:col-span-3"
      )
        .card.shadow-xl.bg-base-100.min-h-0.border.border-base-300(
          class="flex-[2]"
        )
          .card-body.p-3.gap-2.h-full.flex.flex-col
            h4.text-xs.font-bold.text-base-content.opacity-70.uppercase.tracking-wider
              | 📈 Пиковые часы
            .relative.w-full.flex-1.min-h-0
              BarChart(
                :data="peakHoursChartData"
                :options="peakHoursOptions"
              )
        
        .card.shadow-xl.bg-base-100.min-h-0.border.border-base-300(
          class="flex-[1]"
        )
          .card-body.p-3.gap-2.overflow-hidden
            h4.text-xs.font-bold.text-base-content.opacity-70.uppercase.tracking-wider
              | 🚗 Транспорт / Места
            .flex.flex-col.gap-1.overflow-y-auto.custom-scrollbar.text-sm
              .flex.justify-between.items-center(
                v-for="v in activeVehicles"
                :key="v.id"
                class="p-1 rounded hover:bg-base-200 transition-colors"
              )
                span.font-mono.text-xs.font-bold.text-error {{ v.plate }}
                span.opacity-60.truncate {{ v.ownerFio }}
              .border-t.border-base-200.mt-1.pt-1(
                v-if="activeVehicles.length && topDestinations.length"
              )
              .flex.justify-between.items-center(
                v-for="d in topDestinations"
                :key="d.label"
                class="p-1 rounded hover:bg-base-200 transition-colors"
              )
                span.truncate 📍{{ d.label }}
                span.text-xs.opacity-50 {{ d.total }} раз
              .text-center.text-xs.opacity-40.py-2(
                v-if="!activeVehicles.length && !topDestinations.length"
              )
                | Нет данных

    template(#fallback)
      .col-span-12.flex.items-center.justify-center.h-full
        span.loading.loading-lg.loading-spinner.text-primary
</template>

<script setup lang="ts">
// app/pages/reports.vue
// Логика расчетов оптимизирована. Добавлен Map для поиска людей.
// Настройки Chart.js изменены для максимальной плотности графики (убраны лишние отступы).

import { ref, computed, onMounted } from 'vue'
import { Line as LineChart, Bar as BarChart, Doughnut as DoughnutChart } from 'vue-chartjs'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js'
import { useJournal } from '~/composables/useJournal'
import { useShift } from '~/composables/useShift'
import { useDatabase } from '~/composables/useDatabase'

// --- Chart.js Registration ---
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler)

// --- Composables ---
const { journalList, peopleList, formatTime } = useJournal()
const { shiftHistory, currentShift, loadCurrentShift } = useShift()
const { getAllItems } = useDatabase()

// --- State ---
const period = ref('day')
const vehiclesList = ref<any[]>([])

// --- Инициализация ---
onMounted(async () => {
  await Promise.all([
    loadCurrentShift(),
    getAllItems('vehicles').then(data => vehiclesList.value = data || [])
  ])
})

// --- Утилиты ---
const peopleMap = computed(() => {
  const map = new Map<string, any>()
  peopleList.value.forEach(p => map.set(String(p.id), p))
  return map
})

const getStartTime = (periodName: string) => {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  if (periodName === 'day') return startOfDay
  const d = new Date()
  if (periodName === 'week') {
    d.setDate(d.getDate() - 7)
    return d.getTime()
  }
  d.setMonth(d.getMonth() - 1)
  return d.getTime()
}

const formatDuration = (ms: number) => {
  if (!ms || ms < 0) return '—'
  const hours = Math.floor(ms / 3600000)
  const mins = Math.floor((ms % 3600000) / 60000)
  if (hours > 0) return `${hours}ч ${mins}м`
  return `${mins}м`
}

// Проверка: является ли человек жителем
const isResidentCheck = (person: any) => {
  return person?.location?.trim().toLowerCase() !== 'вне территории' && person?.location !== 'outside'
}

// --- Базовый фильтр ---
const filteredEntries = computed(() => {
  const startTime = getStartTime(period.value)
  return journalList.value.filter(e => {
    const t1 = new Date(e.timestamp_out || 0).getTime()
    const t2 = new Date(e.timestamp_in || 0).getTime()
    return Math.max(t1, t2) >= startTime
  })
})

// --- Статистика ---
const stats = computed(() => {
  let residentsOut = 0
  let guestsIn = 0
  let totalDuration = 0
  let completedTrips = 0
  const hourCounts: Record<number, number> = {}

  filteredEntries.value.forEach(entry => {
    const person = peopleMap.value.get(String(entry.person_id))
    if (!person) return
    const isRes = isResidentCheck(person)
    
    if (entry.timestamp_out && !entry.timestamp_in && isRes) residentsOut++
    if (entry.timestamp_in && !entry.timestamp_out && !isRes) guestsIn++

    if (entry.timestamp_out && entry.timestamp_in && isRes) {
      const outTime = new Date(entry.timestamp_out).getTime()
      const inTime = new Date(entry.timestamp_in).getTime()
      if (inTime > outTime) {
        totalDuration += (inTime - outTime)
        completedTrips++
      }
    }

    const checkTime = (ts: any) => {
      if (!ts) return
      const hour = new Date(ts).getHours()
      hourCounts[hour] = (hourCounts[hour] || 0) + 1
    }
    checkTime(entry.timestamp_out)
    checkTime(entry.timestamp_in)
  })

  let peakHour = '—'
  let maxCount = 0
  for (const [hour, count] of Object.entries(hourCounts)) {
    if (count > maxCount) {
      maxCount = count
      peakHour = `${String(hour).padStart(2, '0')}:00`
    }
  }

  return {
    totalEntries: filteredEntries.value.length,
    residentsOut,
    guestsIn,
    avgDuration: completedTrips > 0 ? formatDuration(totalDuration / completedTrips) : '—',
    peakHour
  }
})

// --- 1. Хроника ---
const timelineChartData = computed(() => {
  const startTime = getStartTime(period.value)
  const now = Date.now()
  const MS_IN_HOUR = 3600000
  const loopEndTime = period.value === 'day' ? Math.ceil(now / MS_IN_HOUR) * MS_IN_HOUR : now

  const events: any[] = []
  filteredEntries.value.forEach(e => {
    const person = peopleMap.value.get(String(e.person_id))
    const isRes = isResidentCheck(person)
    if (e.timestamp_out) events.push({ time: new Date(e.timestamp_out).getTime(), type: 'out', isRes })
    if (e.timestamp_in) events.push({ time: new Date(e.timestamp_in).getTime(), type: 'in', isRes })
  })
  events.sort((a, b) => a.time - b.time)

  const allIntervals: any[] = []
  shiftHistory.value.forEach(shift => {
    allIntervals.push({
      start: new Date(shift.start_time).getTime(),
      end: new Date(shift.end_time).getTime(),
      name: shift.guard_name,
      type: 'Смена'
    })
  })
  if (currentShift.value) {
    allIntervals.push({
      start: new Date(currentShift.value.start_time).getTime(),
      end: now,
      name: currentShift.value.guard_name,
      type: 'Смена'
    })
  }

  const labels: string[] = []
  const dataResidents: number[] = [] 
  const dataGuests: number[] = []    
  const dataShiftsCount: number[] = []
  const shiftNamesMap: string[][] = []
  
  let currentResOut = 0
  let currentGuestsIn = 0
  let eventIndex = 0 

  for (let t = startTime; t <= loopEndTime; t += MS_IN_HOUR) {
    labels.push(new Date(t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }))
    while (eventIndex < events.length && events[eventIndex].time < t + MS_IN_HOUR) {
      const ev = events[eventIndex]
      if (ev.type === 'out') {
        if (ev.isRes) currentResOut++
        else currentGuestsIn--
      } else if (ev.type === 'in') {
        if (ev.isRes) currentResOut--
        else currentGuestsIn++
      }
      eventIndex++
    }
    dataResidents.push(currentResOut)
    dataGuests.push(currentGuestsIn)
    
    const activeGuards = new Set<string>()
    allIntervals.forEach(interval => {
      if (t < interval.end && (t + MS_IN_HOUR) > interval.start) {
        activeGuards.add(`${interval.name} (${interval.type === 'cover' ? 'Замена' : 'Смена'})`)
      }
    })
    dataShiftsCount.push(activeGuards.size || 0)
    shiftNamesMap.push(Array.from(activeGuards))
  }
  
  return {
    labels,
    datasets: [
      { label: 'Жители на выезде', data: dataResidents, borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', fill: true, tension: 0.4, yAxisID: 'y', borderWidth: 2 },
      { label: 'Гости внутри', data: dataGuests, borderColor: '#22c55e', backgroundColor: 'rgba(34, 197, 94, 0.1)', fill: true, tension: 0.4, yAxisID: 'y', borderWidth: 2 },
      { label: 'Охрана', data: dataShiftsCount, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, stepped: true, pointRadius: 0, borderWidth: 3, order: 0, yAxisID: 'y1', names: shiftNamesMap }
    ]
  }
})

const timelineChartOptions = {
  responsive: true, 
  maintainAspectRatio: false, 
  interaction: { mode: 'index', intersect: false },
  layout: { padding: { top: 5, bottom: 0, left: 0, right: 0 } },
  scales: {
    x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8, font: { size: 10 } }, grid: { display: false } },
    y: { type: 'linear', display: true, position: 'left', title: { display: false }, beginAtZero: true, ticks: { stepSize: 1, font: { size: 10 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
    y1: { type: 'linear', display: true, position: 'right', title: { display: false }, min: 0, max: 3, grid: { drawOnChartArea: false }, ticks: { stepSize: 1, font: { size: 10 } } }
  },
  plugins: {
    legend: { position: 'top', labels: { boxWidth: 10, padding: 15, font: { size: 11 } } },
    tooltip: {
      callbacks: {
        label: function(context: any) {
          if (context.dataset.label === 'Охрана') {
            const names = context.dataset.names[context.dataIndex] || []
            return names.length ? names.map((n: string) => `👮 ${n}`) : ['❌ Нет охраны']
          }
          return `${context.dataset.label}: ${context.raw}`;
        }
      }
    }
  }
}

// --- 2. Аудитория ---
const audienceChartData = computed(() => {
  let resOut = 0, guestsIn = 0, childrenOut = 0
  filteredEntries.value.forEach(entry => {
    const person = peopleMap.value.get(String(entry.person_id))
    if (!person) return
    const isRes = isResidentCheck(person)
    if (isRes && entry.timestamp_out && !entry.timestamp_in) {
      if (person.category === 'Ребенок') childrenOut++
      else resOut++
    }
    if (!isRes && entry.timestamp_in && !entry.timestamp_out) guestsIn++
  })
  return {
    labels: ['Взрослые', 'Дети', 'Гости'],
    datasets: [{
      data: [resOut, childrenOut, guestsIn],
      backgroundColor: ['rgba(245, 158, 11, 0.8)', 'rgba(168, 85, 247, 0.8)', 'rgba(34, 197, 94, 0.8)'],
      borderWidth: 0,
      spacing: 2
    }]
  }
})

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '70%',
  layout: { padding: 0 },
  plugins: {
    legend: { position: 'bottom', labels: { boxWidth: 10, padding: 8, font: { size: 10 } } }
  }
}

// --- 3. Пиковые часы ---
const peakHoursChartData = computed(() => {
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const outs = new Array(24).fill(0)
  const ins = new Array(24).fill(0)
  filteredEntries.value.forEach(e => {
    if (e.timestamp_out) outs[new Date(e.timestamp_out).getHours()]++
    if (e.timestamp_in) ins[new Date(e.timestamp_in).getHours()]++
  })
  return {
    labels: hours.map(h => `${String(h).padStart(2, '0')}`),
    datasets: [
      { label: 'Ушли', data: outs, backgroundColor: 'rgba(239, 68, 68, 0.6)', borderRadius: 2 },
      { label: 'Пришли', data: ins, backgroundColor: 'rgba(34, 197, 94, 0.6)', borderRadius: 2 }
    ]
  }
})

const peakHoursOptions = {
  responsive: true,
  maintainAspectRatio: false,
  layout: { padding: { top: 5, bottom: 0, left: 0, right: 0 } },
  scales: {
    x: { stacked: true, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12, font: { size: 9 } }, grid: { display: false } },
    y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1, font: { size: 9 } }, grid: { color: 'rgba(0,0,0,0.05)' } }
  },
  plugins: { 
    legend: { display: false } 
  }
}

// --- 4 & 6. Компактные списки (Транспорт и Места) ---
const topAbsentPeople = computed(() => {
  const absent: any[] = []
  filteredEntries.value.forEach(entry => {
    if (!entry.timestamp_out || entry.timestamp_in) return
    const person = peopleMap.value.get(String(entry.person_id))
    if (!person || !isResidentCheck(person)) return
    absent.push({ id: entry.id, fio: person.fio, timestamp_out: entry.timestamp_out })
  })
  return absent.sort((a, b) => new Date(a.timestamp_out).getTime() - new Date(b.timestamp_out).getTime()).slice(0, 5)
})

const activeVehicles = computed(() => {
  if (!vehiclesList.value.length) return []
  const absentOwnerIds = new Set<string>()
  filteredEntries.value.forEach(entry => {
    if (!entry.timestamp_out || entry.timestamp_in) return
    const person = peopleMap.value.get(String(entry.person_id))
    if (!person || !isResidentCheck(person)) return
    absentOwnerIds.add(String(entry.person_id))
  })
  return vehiclesList.value
    .filter(v => absentOwnerIds.has(String(v.owner_id)))
    .map(v => {
      const owner = peopleMap.value.get(String(v.owner_id))
      return { id: v.id, plate: v.plate || 'Без номера', ownerFio: owner?.fio || 'Неизвестен' }
    }).slice(0, 3)
})

const topDestinations = computed(() => {
  const destMap: Record<string, number> = {}
  filteredEntries.value.forEach(e => {
    if (!e.destination) return
    destMap[e.destination] = (destMap[e.destination] || 0) + 1
  })
  return Object.entries(destMap)
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)
})
</script>

<style scoped>
/* app/pages/reports.vue */
/* Скрытие стандартного скроллбара для списка отсутствующих и транспорта */
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
}
</style>
```