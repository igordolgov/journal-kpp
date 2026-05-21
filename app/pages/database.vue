<!-- app/pages/database.vue -->
<!-- Страница базы данных -->
<template lang="pug">
.database-page.flex.flex-col.h-full.min-h-0.gap-4
  //- Заголовок страницы
  .flex.flex-none.justify-between.items-center
    h2.text-2xl.font-bold База данных

  //- Панель управления
  .flex.flex-none.gap-2.pr-3
    //- Поле поиска
    .form-control.relative.flex-1
      svg.absolute.h-4.w-4.text-gray-400.pointer-events-none(
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
        class="left-3 top-1/2 -translate-y-1/2"
      )
        path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z")

      input.input.input-bordered.w-full.pl-3.pr-8.bg-base-100.text-base-content(
        ref="searchInput"
        v-model="searchQuery"
        placeholder="Поиск: ФИО, Телефон, Авто..."
      )

      button.absolute.z-10.text-gray-400.cursor-pointer.transition-colors(
        v-if="searchQuery.length > 0"
        type="button"
        class="right-2 top-1/2 -translate-y-1/2 hover:text-gray-600"
        @click="clearSearch"
      )
        svg.h-4.w-4(fill="none" stroke="currentColor" viewBox="0 0 24 24")
          path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12")

    .flex.gap-2
      button.btn.btn-accent(@click="openCreatePerson") + Человек

  //- Таблица данных
  .flex-1.min-h-0.overflow-hidden.shadow.rounded-box.bg-base-100
    .h-full.overflow-y-auto
      table.w-full.table(:class="getTableClasses" :style="getTableFontStyle")
        thead.sticky.top-0.z-10.bg-base-100
          tr
            th.cursor-pointer(@click="setSort('fio')")
              | ФИО
              span.ml-1.text-xs.opacity-50(v-if="sortField === 'fio'") {{ sortOrder === 1 ? '▲' : '▼' }}
            th.cursor-pointer(@click="setSort('category')")
              | Категория
              span.ml-1.text-xs.opacity-50(v-if="sortField === 'category'") {{ sortOrder === 1 ? '▲' : '▼' }}
            th.cursor-pointer(@click="setSort('location')")
              | Проживание
              span.ml-1.text-xs.opacity-50(v-if="sortField === 'location'") {{ sortOrder === 1 ? '▲' : '▼' }}
            th.w-36 Статус
            th Транспорт
            th.cursor-pointer(@click="setSort('phone')")
              | Телефон
              span.ml-1.text-xs.opacity-50(v-if="sortField === 'phone'") {{ sortOrder === 1 ? '▲' : '▼' }}

        tbody
          tr.hover(
            v-for="p in processedResults"
            :key="p.id"
            :class="getRowClass(p)"
          )
            td.p-2
              .flex.items-center.gap-2
                template(v-if="p._isChild")
                  span.text-base-content.opacity-40 ↳
                  .badge.badge-xs.badge-outline.rounded-md.border.opacity-60 {{ p.relation || 'Ребенок' }}
                span.font-medium.cursor-pointer(
                  class="hover:underline"
                  @click="openPersonDetail(p)"
                  v-html="highlightText(p.fio, highlights[p.id]?.fio)"
                )

            td.p-2
              .flex.flex-col.gap-1
                span {{ p.category }}
                .flex.flex-wrap.gap-1
                  .badge.badge-xs.badge-outline.rounded-md.ml-2.opacity-70.badge-error(v-if="p.exit_category === 'small'") До 14 лет
                  .badge.badge-xs.badge-outline.rounded-md.ml-2.opacity-70.badge-warning(v-if="p.exit_category === 'independent'") До 21:00
                  .badge.badge-xs.badge-outline.rounded-md.ml-2.opacity-70.badge-error(v-if="p.exit_category === 'escort'") Сопров.

            td.p-2
              span.font-medium(:class="p.location === 'На территории' ? 'text-success' : 'text-info'") 
                | {{ p.location || 'На территории' }}

            td.p-2
              .badge.badge-sm.border-warning.text-warning(v-if="p.status") {{ p.status }}
              span.text-base-content.opacity-30(v-else) -

            td.p-2
              .flex.flex-wrap.gap-1(v-if="getVehiclesForPerson(p.id).length")
                .badge.badge-lg.bg-transparent.gap-1.cursor-pointer.transition-transform(
                  v-for="v in getVehiclesForPerson(p.id)"
                  :key="v.id"
                  title="Нажмите для редактирования"
                  class="hover:scale-105"
                  @click="openEditVehicle(v)"
                )
                  span.pl-2.pr-1.text-center.font-semibold.text-black.bg-neutral-400.border-2.border-gray-500.rounded-sm(
                    class="h-6.5 w-23"
                    v-html="formatPlate(v.plate, highlights[p.id]?.vehicles?.[v.id])"
                  )
                  span.pt-1.ml-2.text-xs.text-gray-500(v-if="v.is_primary") (личн.)
              .text-xs.text-gray-400(v-else) -

            td.p-2.text-gray-400
              span(v-html="highlightText(p.phone || '-', highlights[p.id]?.phone)")

  //- МОДАЛЬНЫЕ ОКНА
  DatabasePersonDetailModal(
    :is-open="isPersonDetailOpen"
    :person="detailPerson"
    :vehicles="vehiclesList"
    :people-list="allPeopleList"
    @close="isPersonDetailOpen = false"
    @edit="openEditPerson"
    @delete="handleDeletePerson"
    @assign="isAssignVehicleOpen = true"
    @edit-vehicle="openEditVehicle"
    @update="handleDetailUpdate" 
  )

  DatabaseAssignVehicleModal(
    :is-open="isAssignVehicleOpen"
    :person="detailPerson"
    :vehicles="vehiclesList"
    @close="isAssignVehicleOpen = false"
    @assign="assignVehicleToPerson"
  )

  DatabasePersonFormModal(
    :is-open="isPersonFormOpen"
    :person="editablePerson"
    :all-people="allPeopleList"
    @close="isPersonFormOpen = false"
    @save="handleSavePerson"
  )

  DatabaseVehicleFormModal(
    :is-open="isEditVehicleOpen"
    :vehicle="editableVehicle"
    :all-people="allPeopleList"
    :adult-people="adultPeopleList"
    @close="isEditVehicleOpen = false"
    @save="handleSaveVehicle"
    @delete="handleDeleteVehicle"
  )
</template>

<script setup lang="ts">
import { useDatabase } from '~/composables/useDatabase'
import { useJournal } from '~/composables/useJournal'
import { useConfig } from '~/composables/useConfig'
import { useCompanions } from '~/composables/useCompanions'
import { onMounted, ref, computed, watch, nextTick } from 'vue'
import { useState } from 'nuxt/app'
import Fuse from 'fuse.js'

import { usePersonGenerator } from '~/composables/usePersonGenerator'
const { getDb } = useDatabase()

// --- Composables ---
const { getAllItems, updateItem, deleteItem, addItem, getItem } = useDatabase()
const { loadData } = useJournal()
const { getTableClasses, getTableFontStyle, loadConfig } = useConfig()
const { isChild } = useCompanions()

// --- State: Data ---
const vehiclesList = ref<any[]>([])
const allPeopleList = ref<any[]>([])
const highlights = ref<Record<number, any>>({})

// --- State: UI ---
const searchInput = ref<HTMLInputElement | null>(null)
const searchQuery = ref('')
const debouncedQuery = ref('')
const sortField = ref('fio')
const sortOrder = ref(1)

// --- State: Modals ---
const isPersonDetailOpen = ref(false)
const detailPerson = ref<any>({})
const isPersonFormOpen = ref(false)
const editablePerson = ref<any>(null)
const isAssignVehicleOpen = ref(false)
const isEditVehicleOpen = ref(false)
const editableVehicle = ref<any>(null)

// --- Fuse.js Instances ---
let fusePeople: Fuse<any> | null = null
let fuseVehicles: Fuse<any> | null = null

// =========================================================================
// ГЕНЕРАТОР
// =========================================================================

const randomFrom = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]

const EUROPEAN_SKIN_TONES = ['#FDE8D0', '#FDE2C8', '#FDDCB5', '#F8D5B0', '#F5D0A9', '#EDCAAB', '#E8C4A0', '#E3BE96'] as const
const EUROPEAN_HAIR_COLORS = ['#FAEBD7', '#F5D76E', '#E8C84A', '#D4B84A', '#C4A35A', '#B8956A', '#A67C52', '#8B6B3D', '#7B5B3A', '#6B4226', '#5A3825', '#4A2C17', '#3D2314'] as const
const FACE_WIDTHS = [0.9, 0.95, 1.0, 1.05, 1.1] as const

const hslToHex = (h: number, s: number, l: number) => {
  l /= 100; s /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => { const k = (n + h / 30) % 12; return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1); };
  return `#${[f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('')}`
}
const randomTopColor = () => hslToHex(Math.floor(Math.random() * 360), 40 + Math.random() * 40, 40 + Math.random() * 30)
const randomBottomColor = () => hslToHex(Math.floor(Math.random() * 360), 10 + Math.random() * 30, 15 + Math.random() * 25)

const usedAppearances = new Set<string>()

const generateUniqueAppearance = (
  gender: string, 
  ageGroup: string, 
  familyGenes: { skin: string; hair: string; face: number } | null
): any => {
  const skinTone = familyGenes?.skin || randomFrom(EUROPEAN_SKIN_TONES)
  const hairColor = familyGenes?.hair || randomFrom(EUROPEAN_HAIR_COLORS)
  const faceWidth = familyGenes?.face || randomFrom(FACE_WIDTHS)

  let hairStyle: string
  if (ageGroup === 'child') {
    hairStyle = Math.random() > 0.5 ? 'short' : 'long'
  } else if (gender === 'male') {
    hairStyle = Math.random() > 0.4 ? 'short' : 'long' 
  } else {
    hairStyle = Math.random() > 0.6 ? 'short' : 'long' 
  }

  let attempts = 0
  let appearance: any = null

  do {
    const hasGlasses = Math.random() > 0.5 ? 'glasses' : 'none'
    const topColor = randomTopColor()
    const bottomColor = randomBottomColor()
    
    const comboHash = `${hairStyle}-${hasGlasses}-${topColor}-${bottomColor}`
    
    if (!usedAppearances.has(comboHash)) {
      appearance = {
        skinTone, hairColor, faceWidth,
        hairStyleId: hairStyle,
        glasses: hasGlasses,
        topColor, bottomColor
      }
      usedAppearances.add(comboHash)
      break
    }
    attempts++
  } while (attempts < 20)

  if (!appearance) {
    appearance = {
      skinTone, hairColor, faceWidth,
      hairStyleId: hairStyle,
      glasses: Math.random() > 0.5 ? 'glasses' : 'none',
      topColor: randomTopColor(),
      bottomColor: randomBottomColor()
    }
  }

  return appearance
}

// --- Lifecycle ---
onMounted(async () => {
  await loadConfig()
  await loadData()
  await loadAllData()
  nextTick(() => searchInput.value?.focus())
})

// --- Data Fetching ---
const loadAllData = async () => {
  try {
    const db = await getDb()
    if (!db.objectStoreNames.contains('people')) return
    
    const people = await getAllItems('people')
    allPeopleList.value = people
    vehiclesList.value = db.objectStoreNames.contains('vehicles') ? await getAllItems('vehicles') : []

    // Автоматическая миграция (Семейное проживание + Статусы)
    await migrateFamilyLocationsAndStatus()

    fusePeople = new Fuse(allPeopleList.value, { 
      keys: ['fio', 'phone', 'status'],
      includeMatches: true, threshold: 0.3, minMatchCharLength: 2 
    })
    if (vehiclesList.value.length > 0) {
      fuseVehicles = new Fuse(vehiclesList.value, { keys: ['plate'], includeMatches: true, threshold: 0.3, minMatchCharLength: 2 })
    }

    usedAppearances.clear() 
    await seedMissingAvatars()
  } catch (error) {
    console.error('Ошибка загрузки данных:', error)
  }
}

// =========================================================================
// МИГРАЦИЯ БАЗЫ: СЕМЕЙНОЕ ПРОЖИВАНИЕ И РАЗДЕЛЕНИЕ СТАТУСОВ
// =========================================================================
const migrateFamilyLocationsAndStatus = async () => {
  const TEMP_STATUSES = ['Командировка', 'Отпуск', 'Болен']
  const VALID_LOCATIONS = ['На территории', 'В городе']
  const DEFAULT_LOCATION = 'На территории'
  
  const heads = allPeopleList.value.filter(p => !p.main_family_id)
  const children = allPeopleList.value.filter(p => !!p.main_family_id)
  
  // Карта: ID главы семьи -> валидное проживание
  const familyLocations = new Map<number, string>()
  let updatedCount = 0

  // 1. Сначала валидируем глав семей
  for (const head of heads) {
    let currentLoc = head.location
    let currentStatus = head.status === undefined ? null : head.status

    // Если в location затесался статус
    if (TEMP_STATUSES.includes(currentLoc)) {
      currentStatus = currentLoc
      currentLoc = DEFAULT_LOCATION
    }

    // Защита от мусора
    if (!VALID_LOCATIONS.includes(currentLoc)) {
      currentLoc = DEFAULT_LOCATION
    }

    familyLocations.set(head.id, currentLoc)

    if (head.location !== currentLoc || head.status !== currentStatus) {
      const updates = { ...head, location: currentLoc, status: currentStatus }
      await updateItem('people', updates)
      Object.assign(head, updates)
      updatedCount++
    }
  }

  // 2. Принудительно применяем проживание главы ко всем членам семьи
  for (const child of children) {
    const familyId = child.main_family_id
    // Берем проживание семьи. Если глава удален (сирота), дефолтное
    const familyLoc = familyLocations.get(familyId) || DEFAULT_LOCATION 
    
    let currentStatus = child.status === undefined ? null : child.status
    if (TEMP_STATUSES.includes(child.location)) {
      currentStatus = child.location
    }

    // ЖЕСТКОЕ ПРАВИЛО: проживание ребенка всегда равно проживанию главы
    if (child.location !== familyLoc || child.status !== currentStatus) {
      const updates = { ...child, location: familyLoc, status: currentStatus }
      await updateItem('people', updates)
      Object.assign(child, updates)
      updatedCount++
    }
  }

  if (updatedCount > 0) {
    console.log(`🔄 Семейная миграция location/status: синхронизировано ${updatedCount} записей`)
  }
}

// --- СИДЕР АВАТАРОВ ---
const seedMissingAvatars = async () => {
  const people = allPeopleList.value
  const needAvatars = people.filter(p => !p.avatarVersion || p.avatarVersion < 5)
  if (needAvatars.length === 0) return

  console.log(`📊 Генерация уникальных аватаров (Версия 5) для ${needAvatars.length} персонажей...`)

  const familyGenesMap = new Map<string, { skin: string; hair: string; face: number }>()
  let updatedCount = 0

  for (const person of needAvatars) {
    try {
      const familyId = person.main_family_id || `orphan_${person.id}`
      let familyGenes = familyGenesMap.get(familyId)

      if (!familyGenes) {
        familyGenes = {
          skin: randomFrom(EUROPEAN_SKIN_TONES),
          hair: randomFrom(EUROPEAN_HAIR_COLORS),
          face: randomFrom(FACE_WIDTHS)
        }
        familyGenesMap.set(familyId, familyGenes)
      }

      const uniqueLook = generateUniqueAppearance(
        person.gender || 'male', 
        person.ageGroup || 'adult', 
        familyGenes
      )

      const updates: any = {
        ...person, 
        skinTone: uniqueLook.skinTone,
        hairColor: uniqueLook.hairColor,
        faceWidth: uniqueLook.faceWidth,
        hairStyleId: uniqueLook.hairStyleId,
        glasses: uniqueLook.glasses, 
        clothingStyle: 'standard',
        topColor: uniqueLook.topColor,
        bottomColor: uniqueLook.bottomColor,
        facialHair: (person.gender === 'male' && person.ageGroup === 'adult' && Math.random() > 0.6) ? 'stubble' : 'none',
        headwear: Math.random() > 0.85 ? 'cap' : 'none',
        headwearColor: '#333333',
        animation: { speed: 1, swingAmplitude: 5, bounceAmplitude: 3, armSwing: 15 },
        avatarVersion: 5 
      }

      await updateItem('people', updates)
      
      const localPerson = allPeopleList.value.find(p => p.id === person.id)
      if (localPerson) Object.assign(localPerson, updates)
      
      updatedCount++
      if (updatedCount % 5 === 0) await new Promise(resolve => setTimeout(resolve, 10))
      
    } catch (error) {
      console.error(`Ошибка обновления персонажа ${person.id}:`, error)
    }
  }
  
  console.log(`✅ Обновлено аватаров для ${updatedCount} персонажей`)
}

// --- OPTIMIZATION 1: Native Debounce Helper ---
function debounce(fn: Function, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: any[]) => { clearTimeout(timeoutId); timeoutId = setTimeout(() => fn(...args), delay); };
}

watch(searchQuery, debounce((newVal: string) => { debouncedQuery.value = newVal }, 300))

const clearSearch = () => { searchQuery.value = ''; debouncedQuery.value = ''; searchInput.value?.focus() }

// --- OPTIMIZATION 2: Pre-calculate Vehicles Map ---
const vehiclesByOwner = computed(() => {
  const map = new Map<number, any[]>()
  vehiclesList.value.forEach(v => { if (!map.has(v.owner_id)) map.set(v.owner_id, []); map.get(v.owner_id)!.push(v) })
  return map
})
const getVehiclesForPerson = (id: number) => vehiclesByOwner.value.get(id) || []

// --- Computed Properties ---
const adultPeopleList = computed(() => allPeopleList.value.filter(p => !isChild(p)))

const searchResults = computed(() => {
  const q = debouncedQuery.value.trim()
  if (!q || !fusePeople || !fuseVehicles) return { people: [], vehicles: [] }
  return { people: fusePeople.search(q), vehicles: fuseVehicles.search(q) }
})

watch(searchResults, (res) => {
  const q = debouncedQuery.value.trim()
  if (!q) { highlights.value = {}; return }
  const newHighlights: Record<number, any> = {}
  res.people.forEach(r => { const id = r.item.id; if (!newHighlights[id]) newHighlights[id] = {}; r.matches?.forEach((m: any) => { newHighlights[id][m.key] = m.indices }) })
  res.vehicles.forEach(r => { const ownerId = r.item.owner_id; if (ownerId) { if (!newHighlights[ownerId]) newHighlights[ownerId] = {}; if (!newHighlights[ownerId].vehicles) newHighlights[ownerId].vehicles = {}; newHighlights[ownerId].vehicles[r.item.id] = r.matches?.[0]?.indices } })
  highlights.value = newHighlights
})

const processedResults = computed(() => {
  // 1. БАЗОВЫЙ ФИЛЬТР: Показываем только тех, у кого статус "Доступен" или он пуст (доступен по умолчанию)
  let baseList = allPeopleList.value.filter(p => !p.status || p.status === 'Доступен')

  const q = debouncedQuery.value.trim()
  
  // 2. ПОИСК: Если что-то ввели, фильтруем по тексту (строго внутри доступных людей)
  if (q) {
    const foundIds = new Set<number>()
    searchResults.value.people.forEach(r => foundIds.add(r.item.id))
    searchResults.value.vehicles.forEach(r => { if(r.item.owner_id) foundIds.add(r.item.owner_id) })
    
    // ВАЖНО: раньше тут было allPeopleList.value.filter, что ломало фильтр статуса при поиске
    baseList = baseList.filter(p => foundIds.has(p.id)) 
  }

  // 3. СОРТИРОВКА И ГРУППИРОВКА (логика осталась без изменений)
  const heads = baseList.filter(p => !p.main_family_id)
  const children = baseList.filter(p => p.main_family_id)
  
  heads.sort((a, b) => { 
    let valA = a[sortField.value] ?? ''; 
    let valB = b[sortField.value] ?? ''; 
    if (typeof valA === 'string') valA = valA.toLowerCase(); 
    if (typeof valB === 'string') valB = valB.toLowerCase(); 
    if (valA < valB) return -1 * sortOrder.value; 
    if (valA > valB) return 1 * sortOrder.value; 
    return 0 
  })
  
  children.sort((a, b) => (a.fio || '').localeCompare(b.fio || ''))
  
  const result: any[] = []; 
  const addedChildIds = new Set()
  
  heads.forEach(h => { 
    result.push({ ...h, _isChild: false }); 
    children.filter(c => c.main_family_id === h.id).forEach(kid => { 
      result.push({ ...kid, _isChild: true }); 
      addedChildIds.add(kid.id) 
    }) 
  })
  
  children.forEach(c => { 
    if (!addedChildIds.has(c.id)) result.push({ ...c, _isChild: true }) 
  })
  
  return result
})

// --- Helpers ---
const getRowClass = (p: any) => {
  const classes = []
  if (p._isChild) classes.push('bg-base-200', 'opacity-80')
  if (isChild(p)) classes.push('text-yellow-600', 'font-semibold')
  if (p.exit_category === 'escort') classes.push('bg-red-50')
  return classes
}

const highlightText = (text: string, indices?: any) => {
  if (!indices || indices.length === 0) return text
  const escapedText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  let result = ''; let lastIdx = 0; const sorted = [...indices].sort((a: any, b: any) => a[0] - b[0])
  sorted.forEach((range: any) => { const [start, end] = range; const length = end - start + 1; if (length < 3) { result += escapedText.slice(lastIdx, end + 1); lastIdx = end + 1; return } result += escapedText.slice(lastIdx, start); result += `<span class="text-yellow-200 rounded px-0.5">${escapedText.slice(start, end + 1)}</span>`; lastIdx = end + 1 })
  result += escapedText.slice(lastIdx); return result
}

const formatPlate = (text: string, indices?: any) => {
  if (!text) return ''; const parts = text.split(' '); const region = parts.length > 1 ? parts.pop() : ''; const main = parts.join(' '); if (!region) return highlightText(text, indices); const regionOffset = main.length + 1;
  const process = (str: string, offset: number) => { const escaped = str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); if (!indices || indices.length === 0) return escaped; let res = ''; let last = 0; const relevantIndices = indices.filter((r: any) => r[0] >= offset && r[0] < offset + str.length); relevantIndices.sort((a: any, b: any) => a[0] - b[0]).forEach((range: any) => { const start = range[0] - offset; const end = range[1] - offset; if (start < 0 || end >= str.length) return; res += escaped.slice(last, start); res += `<span class="bg-yellow-200 text-black rounded px-0.5">${escaped.slice(start, end + 1)}</span>`; last = end + 1; }); res += escaped.slice(last); return res; };
  return `${process(main, 0)} <sup>${process(region, regionOffset)}</sup>`;
};

const setSort = (field: string) => { if (sortField.value === field) sortOrder.value = sortOrder.value * -1; else { sortField.value = field; sortOrder.value = 1 } }

// --- Actions ---
const openPersonDetail = (person: any) => { detailPerson.value = person; isPersonDetailOpen.value = true }
const handleDetailUpdate = async () => { await loadAllData(); if (detailPerson.value?.id) { const freshData = await getItem('people', detailPerson.value.id); if (freshData) detailPerson.value = freshData } }
const openCreatePerson = () => { editablePerson.value = null; isPersonFormOpen.value = true }
const openEditPerson = (person: any) => { editablePerson.value = person; isPersonDetailOpen.value = false; isPersonFormOpen.value = true }

const handleSavePerson = async (formData: any) => {
  if (!formData.fio) return alert('Введите ФИО')
  const payload = { ...formData }; if (!payload.main_family_id) payload.relation = ''
  
  // >>> САМОЕ ВАЖНОЕ ДЛЯ СОХРАНЕНИЯ СЕМЕЙНОГО ПРАВИЛА <<<
  // Если редактируется член семьи (не глава), мы Forced перезаписываем его location
  // беря значение от главы семьи, чтобы пользователь не сломал логику руками.
  if (payload.main_family_id) {
    const head = allPeopleList.value.find(p => p.id === payload.main_family_id)
    if (head) {
      payload.location = head.location
    }
  }

  if (payload.id) await updateItem('people', payload); else { delete payload.id; await addItem('people', payload) }
  isPersonFormOpen.value = false; await loadAllData()
}

const handleDeletePerson = async (id: number) => { if (!id) return; if (!confirm('Удалить человека?')) return; await deleteItem('people', id); isPersonDetailOpen.value = false; await loadAllData() }

const assignVehicleToPerson = async (vehicle: any) => {
  const currentIds = vehicle.allowed_driver_ids || (vehicle.owner_id ? [vehicle.owner_id] : [])
  if (currentIds.includes(detailPerson.value.id)) { isAssignVehicleOpen.value = false; return }
  await updateItem('vehicles', { ...vehicle, allowed_driver_ids: [...new Set([...currentIds, detailPerson.value.id])] })
  vehiclesList.value = await getAllItems('vehicles'); isAssignVehicleOpen.value = false
}

const openEditVehicle = (vehicle: any) => { editableVehicle.value = vehicle; isEditVehicleOpen.value = true; isPersonDetailOpen.value = false }

const handleSaveVehicle = async (formData: any) => {
  if (!formData.owner_id) { alert("Выберите владельца!"); return }
  const owner = allPeopleList.value.find(p => p.id === formData.owner_id); const cleanFormData = JSON.parse(JSON.stringify(formData))
  const payload = { ...cleanFormData, owner_name: owner ? (owner.fio_short || owner.fio.split(' ')[0]) : 'Неизвестно', is_primary: cleanFormData.is_primary ?? false }
  await updateItem('vehicles', payload); isEditVehicleOpen.value = false; vehiclesList.value = await getAllItems('vehicles')
}

const handleDeleteVehicle = async (id: number) => { if (!id) return; if (confirm('Удалить транспорт?')) { await deleteItem('vehicles', id); isEditVehicleOpen.value = false; vehiclesList.value = await getAllItems('vehicles') } }
</script>