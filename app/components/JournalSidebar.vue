<template lang="pug">
.sidebar.flex.flex-col.flex-shrink-0.w-full(
  class="lg:top-0 lg:sticky bg-base-200 rounded-box lg:w-80 lg:h-fit"
)
  //- ==========================================
  //- 1. ПОИСК
  //- ==========================================
  .form-control.relative.mb-0
    .relative
      input.input.w-full.pr-0.transition-all.duration-300(
        ref="globalSearchInput"
        v-model="globalSearch"
        placeholder="Поиск: ФИО, Гос. номер..."
        class="bg-base-100 input-bordered input-sm"
        :class="dropdownResults.length > 0 && isSearchFocused ? 'rounded-b-none border-primary border-b-0 shadow-none z-40 relative' : ''"
        @focus="onSearchFocus"
        @blur="onSearchBlur"
        @wheel.prevent="handleSearchWheel"
        @keydown.down.prevent="handleArrowDown"
        @keydown.up.prevent="handleArrowUp"
        @keydown.enter.prevent="handleEnterKey"
      )
      button.absolute.z-50.right-2.transition-colors.duration-200(
        class="top-1/2 hover:text-primary -translate-y-1/2"
        v-if="globalSearch"
        type="button"
        @click="clearSearch"
      )
        svg.h-4.w-4(fill="none" stroke="currentColor" viewBox="0 0 24 24")
          path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12")

    //- РЕЗУЛЬТАТЫ ПОИСКА / СПИСОК ДОСТУПНЫХ
    transition(name="search-results")
      .absolute.left-0.right-0.top-10.z-50.-mt-px.overflow-hidden.shadow-lg(
        v-if="dropdownResults.length > 0 && isSearchFocused"
        class="bg-base-100 border border-primary border-t-0 rounded-b-xl"
      )
        .max-h-80.overflow-y-auto.mt-3(ref="dropdownListRef")
          .flex.items-center.gap-3.p-1.mb-1.cursor-pointer.transition-all(
            v-for="(item, index) in dropdownResults"
            :key="item.id + item.type"
            :data-index="index"
            class="hover:bg-base-200 rounded-lg active:scale-99"
            :class="{ 'bg-primary/20': activeDropdownIndex === index }"
            @mousedown.prevent="selectItem(item)" 
            @mouseenter="activeDropdownIndex = index"
            :title="item.type === 'person' ? item.fio : 'Владелец: ' + (item.owner_name || 'неизвестен')"
          )
            .flex.items-center.justify-center.flex-shrink-0.w-10.h-10.transition-colors.rounded-full(
              class="bg-base-200"
              class="hover:bg-primary hover:text-primary-content"
            )
              span.text-xl {{ item.type === 'person' ? '👤' : '🚗' }}
            .flex-1.min-w-0
              .flex.items-center.gap-2
                span.font-semibold.truncate(
                  :class='{ "text-yellow-500": item.type === "person" && isChild(item) }'
                ) 
                  | {{ item.displayShort || item.display }}
                template(v-if="item.type === 'person'")
                  .badge.badge-xs.badge-ghost(v-if="item.category")
                    | {{ item.category }}
              .text-xs.mt-0_5.truncate(v-if="item.location" class="text-base-content/60")
                span 📍 {{ item.location }}

    //- Сценарий: Выбор водителя
    transition(name="search-results")
      .absolute.left-0.right-0.top-full.z-50.-mt-px.overflow-hidden.shadow-lg(
        v-if="selectingDriverForVehicle"
        class="bg-base-100 border border-primary border-t-0 rounded-b-xl"
      )
        .p-2
          h3.p-2.mb-2.text-xs.font-bold.uppercase(class="text-base-content/60")
            | 🚗 Кто за рулем?
          .flex.items-center.gap-3.p-3.mb-1.cursor-pointer.transition-all(
            v-for="p in potentialDrivers"
            :key="p.id"
            class="hover:bg-base-200 rounded-lg"
            @mousedown.prevent="selectDriver(p)"
          )
            .flex.items-center.justify-center.flex-shrink-0.w-10.h-10.rounded-full(
              class="bg-base-200"
            )
              span.text-xl 👤
            .flex-1.min-w-0
              span.font-semibold
                | {{ p.fio }}
              .badge.badge-xs.badge-ghost.ml-2(v-if="p.category")
                | {{ p.category }}

  //- ==========================================
  //- 2. КАРТОЧКА ВЫБРАННОГО
  //- ==========================================
  .mt-0(v-if="selectedItem")
    .card.overflow-hidden.shadow-xl.border(
      class="bg-base-100 border-base-200"
    )
      .card-body.p-0
        
        //- Заголовок карточки
        .flex.justify-between.items-center.gap-3.px-2.pt-2.border-b(
          class="bg-linear-to-r from-primary/5 to-base-100 border-base-200"
        )
          .flex.items-center.gap-3
            .avatar.online(class="before:bg-success/80")
              .w-12.rounded-full.bg-primary.text-primary-content
                span.text-3xl.pl-1
                  | {{ selectedItem.type === 'person' ? '👤' : '🚗' }}
            
            .flex-1.min-w-0
              h2.card-title.text-lg.leading-tight.truncate(
                :title="selectedItem.fio || selectedItem.display"
              )
                | {{ formatShortFio(selectedItem.fio || selectedItem.display) }}
              .flex.items-center.gap-1.mt-0.text-xs(
                class="text-base-content/50"
              )
                span.opacity-70
                  | {{ selectedItem.category || 'Транспорт' }}
                span.opacity-30 •
                span.truncate
                  | {{ selectedItem.location || '—' }}

          button.btn.btn-circle.btn-ghost.btn-xs(
            class="text-base-content/40"
            title="Сбросить"
            @click="handleDeselect"
          )
            svg.h-4.w-4(fill="none" stroke="currentColor" viewBox="0 0 24 24")
              path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12")

        //- Заметка
        .p-3(v-if="activeTripNote")
          .p-3.shadow-sm.rounded-r-md.border-l-4(
            class="bg-amber-50 border-amber-400 text-amber-900"
          )
            .flex.gap-2
              span.text-2xl 📝
              div
                span.font-bold.text-amber-700 Заметка:
                p.text-xs.mt-1 {{ activeTripNote }}

        //- Ограничения
        .p-3.pb-0(v-if="personRestrictions.length")
          .flex.flex-col.gap-1.p-2.shadow-sm(
            class="bg-warning/80 text-warning-content alert-warning"
          )
            .flex.items-center.gap-1.font-bold
              svg.h-4.w-4(fill="none" stroke="currentColor" viewBox="0 0 24 24")
                path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z")
              span Внимание! 
              span.text-xs.ml-3
                | {{ personRestrictions.join(', ') }}

        //- ==========================================
        //- 3. КОНСТРУКТОР ПОЕЗДКИ
        //- ==========================================
        template(v-if="!canStartTrip")
          .p-4
            .p-2.text-xs.font-bold(
              class="bg-warning/10 text-warning-content alert-warning"
            )
              | {{ statusTitle }}
        
        template(v-else)
          .flex.flex-col.gap-3.p-3.pt-0
            //- Шаг 1: Куда
            div
              label.block.mb-1.text-xs.font-bold.uppercase(
                class="text-base-content/40"
              )
                | Куда направляемся?
              .join.w-full
                input.input.join-item.flex-1.input-sm(
                  v-model="tripDestination"
                  placeholder="Введите место"
                  class="input-bordered"
                )
                button.btn.join-item.btn-sm(
                  type="button"
                  :class="tripNote ? 'btn-warning' : 'btn-ghost'"
                  @click="isEditingNote = !isEditingNote"
                )
                  span(v-if="tripNote") 📝
                  span(v-else) ✏️

            //- Популярные места
            .flex.flex-wrap.gap-1
              template(v-for="dest in sortedDestinations" :key="dest.name")
                .inline-flex.items-center.gap-0_5.px-3.py-1.text-xs.font-semibold.cursor-pointer.transition-all.rounded-full(
                  @click="tripDestination = dest.name"
                  class="bg-base-200 hover:shadow-md border border-base-300"
                  :class="tripDestination === dest.name ? 'ring-2 ring-primary ring-offset-1 bg-primary text-primary-content' : ''"
                )
                  span {{ dest.name }}
                  button.opacity-50.transition-opacity(
                    class="hover:opacity-100"
                    @click.stop="removeDest(dest.name)"
                  )
                    svg.h-3.w-3(fill="none" stroke="currentColor" viewBox="0 0 24 24")
                      path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12")
              
              .badge.badge-sm.gap-1.cursor-pointer.transition-colors(
                v-if="isNewDestination"
                class="bg-gray-600 hover:bg-gray-500"
                @click="saveNewDestination"
              ) 
                | + Сохранить

            //- Заметка (Редактор)
            transition(name="slide-fade")
              .form-control.mt-1(v-if="isEditingNote || tripNote")
                .relative
                  textarea.textarea.w-full.h-12.pr-6.textarea-sm(
                    v-model="tripNote"
                    placeholder="Заметка..."
                    class="textarea-warning"
                    @blur="handleNoteBlur"
                  )
                  button.absolute.top-2.right-2(
                    class="hover:text-error text-base-content/50"
                    v-if="tripNote"
                    type="button"
                    @click="clearNote"
                  )
                    svg.h-4.w-4(fill="none" stroke="currentColor" viewBox="0 0 24 24")
                      path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12")

            //- Шаг 2: Добавить
            template(v-if="showAddSection")
              .divider.-my-2
              .text-xs.font-bold.uppercase(
                class="text-base-content/40"
              )
                | Добавить:

              //- Авто владельца
              .mb-1(v-if="availableVehicles.length")
                .flex.flex-wrap.gap-1
                  .badge.gap-1.mr-1.p-1.cursor-pointer.transition-colors.font-semibold.border.border-gray-400.rounded-sm(
                    v-for="v in availableVehicles"
                    :key="v.id"
                    class="bg-white hover:border-primary text-black"
                    @click="selectVehicle(v)"
                  ) 
                    | {{ v.plate }}

              //- Рекомендованные
              div(v-if="availableRelatives.length")
                .flex.flex-wrap.gap-1.max-h-auto.overflow-y-auto
                  template(v-for="p in availableRelatives" :key="p.id")
                    .btn.btn-sm.p-2.py-0.transition-colors.border.rounded-lg(
                      class="bg-secondary/20"
                      :class="canJoinTrip(p) ? 'hover:badge-primary cursor-pointer' : 'cursor-not-allowed'"
                      @click="tryAddPassenger(p)"
                    )
                      | {{ formatShortFio(p.fio) }}
                      span.text-xs.ml-0(
                        class="opacity-60"
                      ) ({{ getRelationLabel(p) }})
                      span.text-xs.ml-0(
                        class="opacity-50"
                        v-if="!canJoinTrip(p)"
                      ) 
                        | [{{ getPersonStatusTextLocal(p) }}]

              //- Подсказка
              .text-xs.mt-1(
                v-if="!availableRelatives.length && eligibleCompanions.length"
                class="text-base-content/40"
              )
                span.info.mr-1 Родственники есть, но они в другой локации.

            //- Поиск попутчиков
            .form-control.relative
              input.input.w-full.input-sm(
                ref="passengerInputRef"
                v-model="passengerSearchQuery"
                placeholder="Поиск попутчиков..."
                class="input-bordered"
                @input="handlePassengerSearch"
                @focus="handlePassengerFocus"
                @blur="handlePassengerBlur"
                @wheel="handlePassengerWheel"
              )
              transition(name="slide-fade")
                .absolute.left-0.right-0.top-full.mt-1.shadow.z-50.max-h-40.overflow-y-auto(
                  ref="passengerListEl"
                  v-if="foundPassengers.length"
                  class="bg-base-100 rounded-box"
                )
                  ul.menu.menu-compact.w-full(
                    class="bg-base-100"
                  )
                    li(v-for="p in foundPassengers" :key="p.item.id")
                      a(
                        :class="[getPassengerClass(p.item), { 'text-yellow-500 font-semibold': isChild(p.item) }]"
                        @click="tryAddPassenger(p.item)"
                      )
                        span {{ p.item.fio }}

            //- Состав поездки
            template(v-if="selectedVehicle || tripPassengers.length > 0")
              .text-xs.font-bold.uppercase(
                class="text-base-content/40"
              )
                | Состав:
              
              .flex.flex-wrap
                .inline-flex.items-center.gap-1.p-0.pr-2.mb-1.mr-1.cursor-pointer.transition-all.bg-gradient-to-br(
                  v-if="selectedVehicle"
                  @click="deselectVehicle"
                  class="from-base-100 to-base-200 shadow-sm hover:shadow-md border border-base-300 rounded-full"
                )
                  span.px-1.font-semibold.border.border-gray-400.rounded-md(
                    class="bg-white text-black"
                  )
                    | {{ selectedVehicle.plate }}
                  svg.h-4.w-4.opacity-60(
                    class="hover:text-error"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  )
                    path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12")

                .inline-flex.items-center.gap-1.p-1.pr-1.mb-1.mr-1.text-xs.cursor-pointer.transition-all.bg-gradient-to-br(
                  v-for="p in tripPassengers"
                  :key="p.id"
                  @click="removePassenger(p)"
                  class="bg-primary shadow-sm hover:shadow-md border border-base-300 rounded-lg"
                )
                  span.p-1.font-semibold {{ formatShortFio(p.fio) }}
                  span.text-xs(
                    class="opacity-60"
                  ) ({{ getRelationLabel(p) }})
                  svg.h-4.w-4.opacity-60(
                    class="hover:text-error"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  )
                    path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12")

            //- ПРЕДУПРЕЖДЕНИЯ
            .mt-2(v-if="needsEscortConfirmation")
              .flex.flex-col.w-full.p-2.text-xs.shadow-sm(
                class="bg-error/10 text-error-content alert-error"
              )
                span.font-bold ⚠️ Требуется сопровождение!
                span.text-xs.opacity-80 Этот человек не может выходить один.
              label.label.justify-start.gap-2.p-2.rounded.mt-1.cursor-pointer(
                class="bg-base-200"
              )
                input.checkbox.checkbox-xs.checkbox-primary(
                  type="checkbox"
                  v-model="escortSoloAllowed"
                )
                span.text-xs(
                  class="text-base-content/60"
                ) Разрешить выход одному

            .mt-2(v-if="needsPermissionConfirmation")
              label.label.justify-start.gap-2.p-2.rounded.cursor-pointer(
                class="bg-base-200"
              )
                input.checkbox.checkbox-xs.checkbox-primary(
                  type="checkbox"
                  v-model="permissionConfirmed"
                )
                span.text-xs(
                  class="text-base-content/60"
                ) Подтвердите разрешение

            .mt-2(v-if="needsChildSoloExitConfirmation")
              .flex.flex-col.w-full.p-2.shadow-sm(
                class="bg-info/10 text-info-content alert-info"
              )
                span.text-sm.text-warning.font-bold.text-center ℹ️ Ребенок выходит один?
              label.label.justify-start.gap-2.p-2.rounded.cursor-pointer(
                class="bg-base-200"
              )
                input.checkbox.checkbox-xs.checkbox-secondary.rounded-sm(
                  type="checkbox"
                  v-model="childSoloExitConfirmed"
                )
                span.text-xs.text-secondary Подтвердить выход без сопровождения

            .mt-2(v-if="needsChildArrivalConfirmation")
              .flex.flex-col.w-full.p-2.shadow-sm(
                class="bg-info/10 text-info-content alert-info"
              )
                span.text-sm.font-bold.text-center.text-base-content ℹ️ Ребенок приехал один?
              label.label.justify-start.gap-2.p-2.rounded.cursor-pointer(
                class="bg-base-200"
              )
                input.checkbox.checkbox-xs.checkbox-secondary.rounded-sm(
                  type="checkbox"
                  v-model="childSoloArrivalConfirmed"
                )
                span.text-xs(
                  class="text-white"
                ) Подтвердить въезд без сопровождения

            //- КНОПКА ДЕЙСТВИЯ
            .mt-0
              template(v-if="selectedVehicle")
                button.btn.btn-block.btn-sm.text-base.font-normal.rounded-xl.shadow-lg(
                  :disabled="!isTripValid"
                  class="bg-green-700 disabled:bg-gray-400 text-white"
                  @click="handleGroupTrip"
                )
                  | 🚗 {{ actionButtonLabel }} 
                  span.ml-1 ({{ totalPeopleCount }})

              template(v-else)
                button.btn.btn-block.btn-sm.text-base.rounded-xl.shadow-lg(
                  :class="(isResidentInside || isGuestInside) ? 'btn-success' : 'btn-info'"
                  :disabled="!isTripValid"
                  @click="handleWalkingTrip"
                )
                  | {{ walkingButtonLabel }}
                
              p.text-center.text-xs.mt-2.font-semibold(
                v-if="validationError"
                class="text-error"
              )
                | {{ validationError }}
</template>

<script setup lang="ts">
// app/components/JournalSidebar.vue — script
// Конструктор поездки: поиск, выбор, валидация, действия.
// [UI/UX] alert() заменены на тосты; confirm() в removeDest — на ConfirmDialog.
import { ref, computed, watch, toRaw, onMounted, nextTick } from 'vue'
import { useState } from 'nuxt/app'
import { useConfig } from '~/composables/useConfig'
import { useFamily } from '~/composables/useFamily'
import { useCompanions } from '~/composables/useCompanions'
import { useToast } from '~/composables/useToast'
// [ДОБАВЛЕНО] ConfirmDialog — используется в removeDest
import { useConfirm } from '~/composables/useConfirm'
import Fuse from 'fuse.js'

// --- Props ---
const props = withDefaults(defineProps<{
  selectedItem?: any
  peopleList?: any[]
  vehiclesList?: any[]
  processedJournal?: any[]
}>(), {
  selectedItem: null,
  peopleList: () => [],
  vehiclesList: () => [],
  processedJournal: () => []
})

const emit = defineEmits(['update:selectedItem', 'action', 'group-action'])
const configStore = useConfig()
const toast = useToast()
// [ДОБАВЛЕНО] confirmDialog для removeDest
const { confirmDialog } = useConfirm()

const { getFamilyRoot, getFullFamily } = useFamily()
const { getPersonLocationStatus, getPersonStatusText, isValidGuardianFor, isChild, canPhysicallyJoin, getEligibleCompanions, validateTrip } = useCompanions()

// --- STATE ---
const globalSearchInput = ref<HTMLInputElement | null>(null)
const globalSearch = useState<string>('kpp-global-search', () => '')
const isSearchFocused = ref(false)
const activeDropdownIndex = ref(-1)
const dropdownListRef = ref<HTMLElement | null>(null)
const isSelecting = ref(false)
const selectedVehicle = ref<any>(null)
const tripPassengers = ref<any[]>([])
const tripDestination = ref('Город')
const tripNote = ref('')
const isEditingNote = ref(false)
const passengerSearchQuery = ref('')
const foundPassengers = ref<any[]>([])
const permissionConfirmed = ref(false)
const escortSoloAllowed = ref(false)
const childSoloArrivalConfirmed = ref(false)
const childSoloExitConfirmed = ref(false)
const passengerInputRef = ref<HTMLInputElement | null>(null)
const passengerListEl = ref<HTMLElement | null>(null)
const selectingDriverForVehicle = ref<any>(null)
const potentialDrivers = ref<any[]>([])
const pendingPassengerToAdd = ref<any>(null)

// --- ФИЛЬТРАЦИЯ И ПОИСК ---
const availablePeople = computed(() => {
  return (props.peopleList || []).filter(p => !p.status || p.status === 'Доступен')
})

const layoutMap: Record<string, string> = {
  'q': 'й', 'w': 'ц', 'e': 'у', 'r': 'к', 't': 'е', 'y': 'н', 'u': 'г', 'i': 'ш', 'o': 'щ', 'p': 'з', '[': 'х', ']': 'ъ',
  'a': 'ф', 's': 'ы', 'd': 'в', 'f': 'а', 'g': 'п', 'h': 'р', 'j': 'о', 'k': 'л', 'l': 'д', ';': 'ж', "'": 'э',
  'z': 'я', 'x': 'ч', 'c': 'с', 'v': 'м', 'b': 'и', 'n': 'т', 'm': 'ь', ',': 'б', '.': 'ю',
  'й': 'q', 'ц': 'w', 'у': 'e', 'к': 'r', 'е': 't', 'н': 'y', 'г': 'u', 'ш': 'i', 'щ': 'o', 'з': 'p', 'х': '[', 'ъ': ']',
  'ф': 'a', 'ы': 's', 'в': 'd', 'а': 'f', 'п': 'g', 'р': 'h', 'о': 'j', 'л': 'k', 'д': 'l', 'ж': ';', 'э': "'",
  'я': 'z', 'ч': 'x', 'с': 'c', 'м': 'v', 'и': 'b', 'т': 'n', 'ь': 'm', 'б': ',', 'ю': '.'
}

const switchLayout = (str: string) => str.split('').map(char => layoutMap[char.toLowerCase()] || char).join('')
const fusePeopleOptions = { includeScore: true, threshold: 0.4, ignoreLocation: true, minMatchCharLength: 2, keys: [{ name: 'fio', weight: 2 }, { name: 'fio_short', weight: 1.5 }, 'phone'] }
const fuseVehicleOptions = { includeScore: true, threshold: 0.4, ignoreLocation: true, keys: [{ name: 'plate', weight: 2 }, { name: 'model', weight: 1 }] }

const fusePeople = computed(() => new Fuse(toRaw(availablePeople.value) || [], fusePeopleOptions))
const fuseVehicles = computed(() => new Fuse(toRaw(props.vehiclesList) || [], fuseVehicleOptions))

// ---- dropdownResults ----
const dropdownResults = computed(() => {
  const query = globalSearch.value.trim()

  if (query.length < 1) {
    return availablePeople.value.map(p => ({
      ...p,
      type: 'person',
      display: p.fio,
      displayShort: p.fio_short || formatShortFio(p.fio)
    }))
  }

  const queryVariants = new Set([query])
  const converted = switchLayout(query)
  if (converted !== query) queryVariants.add(converted)

  const foundPeople: any[] = []
  const foundVehicles: any[] = []
  const addedIds = new Set()

  queryVariants.forEach(q => {
    fusePeople.value.search(q).forEach(r => {
      if (!addedIds.has(`p_${r.item.id}`)) {
        foundPeople.push({ ...r.item, type: 'person', display: r.item.fio, displayShort: r.item.fio_short || formatShortFio(r.item.fio) })
        addedIds.add(`p_${r.item.id}`)
      }
    })
    fuseVehicles.value.search(q).forEach(r => {
      if (!addedIds.has(`v_${r.item.id}`)) {
        foundVehicles.push({ ...r.item, type: 'vehicle', display: r.item.plate, displayShort: r.item.plate })
        addedIds.add(`v_${r.item.id}`)
      }
    })
  })

  const hasDigits = /\d/.test(query)
  if (hasDigits) return [...foundVehicles, ...foundPeople]
  else return [...foundPeople, ...foundVehicles]
})
// ---- КОНЕЦ dropdownResults ----

const formatShortFio = (fio: string) => {
  if (!fio) return ''
  const parts = fio.trim().split(/\s+/)
  const first = parts[0]
  if (!first) return ''
  if (parts.length === 1) return first
  return `${first} ${parts.slice(1).map(n => n.charAt(0).toUpperCase() + '.').join(' ')}`
}

// --- ОБРАБОТЧИКИ ВЗАИМОДЕЙСТВИЯ С ДРОПДАУНОМ ---
const onSearchFocus = () => {
  isSearchFocused.value = true
  activeDropdownIndex.value = -1
}

const onSearchBlur = () => {
  setTimeout(() => {
    isSearchFocused.value = false
    activeDropdownIndex.value = -1
  }, 200)
}

const handleSearchWheel = (e: WheelEvent) => {
  if (!isSearchFocused.value || !dropdownListRef.value) return
  const listEl = dropdownListRef.value
  listEl.scrollTop += e.deltaY > 0 ? 40 : -40
}

const handleArrowDown = () => {
  if (!isSearchFocused.value || dropdownResults.value.length === 0) return
  if (activeDropdownIndex.value < dropdownResults.value.length - 1) {
    activeDropdownIndex.value++
    scrollDropdownItemIntoView()
  } else {
    activeDropdownIndex.value = 0
    scrollDropdownItemIntoView()
  }
}

const handleArrowUp = () => {
  if (!isSearchFocused.value || dropdownResults.value.length === 0) return
  if (activeDropdownIndex.value > 0) {
    activeDropdownIndex.value--
    scrollDropdownItemIntoView()
  } else {
    activeDropdownIndex.value = dropdownResults.value.length - 1
    scrollDropdownItemIntoView()
  }
}

const handleEnterKey = () => {
  // индекс массива даёт элемент | undefined — guard
  const active = activeDropdownIndex.value >= 0 ? dropdownResults.value[activeDropdownIndex.value] : undefined
  if (active) {
    selectItem(active)
  } else if (dropdownResults.value.length === 1) {
    const single = dropdownResults.value[0]
    if (single) selectItem(single)
  }
}

const scrollDropdownItemIntoView = () => {
  nextTick(() => {
    if (!dropdownListRef.value) return
    const activeEl = dropdownListRef.value.querySelector(`[data-index="${activeDropdownIndex.value}"]`) as HTMLElement
    activeEl?.scrollIntoView({ block: 'nearest' })
  })
}

// --- ПОПУЛЯРНЫЕ НАПРАВЛЕНИЯ ---
const popularDestinations = computed(() => configStore.config.value?.destinations || [])
const sortedDestinations = computed(() => {
  if (!props.selectedItem) return popularDestinations.value.map((name: string) => ({ name, type: 'global' as const }))
  const history = props.processedJournal.filter((e: any) => String(e.person_id) === String(props.selectedItem.id) && e.destination).map((e: any) => e.destination)
  const counts: Record<string, number> = {}
  history.forEach(d => { counts[d] = (counts[d] || 0) + 1 })
  const sortedHistory = Object.keys(counts).sort((a, b) => counts[b]! - counts[a]!)
  const result: { name: string; type: 'history' | 'global' }[] = []
  sortedHistory.forEach(name => result.push({ name, type: 'history' }))
  popularDestinations.value.forEach((name: string) => { if (!counts[name]) result.push({ name, type: 'global' }) })
  return result
})

const isNewDestination = computed(() => {
  const val = tripDestination.value.trim()
  return val.length >= 2 && !sortedDestinations.value.some((d: any) => d.name.toLowerCase() === val.toLowerCase())
})

const saveNewDestination = async () => {
  if (tripDestination.value.trim()) await configStore.addDestination(tripDestination.value.trim())
}

const removeDest = async (dest: string) => {
  // [UI/UX] нативный confirm -> ConfirmDialog
  const ok = await confirmDialog({
    title: `Удалить «${dest}»?`,
    message: 'Место исчезнет из подсказок для всех сотрудников.',
    confirmLabel: 'Удалить',
    danger: true
  })
  if (!ok) return
  await configStore.removeDestination(dest)
  if (tripDestination.value === dest) tripDestination.value = ''
}

// --- СТАТУСЫ ---
const activeTripRecord = computed(() => {
  if (!props.selectedItem || props.selectedItem.type !== 'person') return null
  const personId = String(props.selectedItem.id)
  return props.processedJournal.find((e: any) =>
    String(e.person_id) === personId && e.timestamp_out && !e.timestamp_in
  ) || null
})

const mainPersonStatus = computed(() => getPersonLocationStatus(props.selectedItem, props.processedJournal))

const actualStatus = computed(() => {
  if (activeTripRecord.value) return 'outside'
  return mainPersonStatus.value
})

const isResident = computed(() => {
  const loc = props.selectedItem?.location?.trim().toLowerCase() || ''
  if (!loc) return true
  return !(loc.includes('город') || loc === 'outside' || loc === 'вне территории')
})

const isResidentInside = computed(() => isResident.value && actualStatus.value === 'inside')
const isResidentOutside = computed(() => isResident.value && actualStatus.value === 'outside')
const isGuestOutside = computed(() => !isResident.value && actualStatus.value === 'outside')
const isGuestInside = computed(() => !isResident.value && actualStatus.value === 'inside')

const canStartTrip = computed(() => isResidentInside.value || isGuestOutside.value || isResidentOutside.value || isGuestInside.value)
const statusTitle = computed(() => {
  if (!props.selectedItem) return ''
  if (!canStartTrip.value) return 'Недоступно (уже в пути?)'
  return ''
})

const personCategory = computed(() => props.selectedItem?.exit_category || (isChild(props.selectedItem) ? 'small' : 'adult'))
const personRestrictions = computed(() => {
  const r: string[] = []
  if (!props.selectedItem) return []
  if (props.selectedItem.exit_category === 'small') r.push('Только со взрослым')
  if (props.selectedItem.exit_category === 'independent') r.push('До 21:00')
  if (props.selectedItem.exit_category === 'permission') r.push('По звонку')
  if (props.selectedItem.exit_category === 'escort') r.push('Требует сопровождения')
  return r
})
const activeTripNote = computed(() => activeTripRecord.value?.note || null)

// --- АВТОМОБИЛИ ---
const suggestedVehicles = computed(() => {
  if (!props.selectedItem || props.selectedItem.type !== 'person') return []
  const personId = props.selectedItem.id
  return props.vehiclesList.filter((v: any) => v.owner_id === personId || (v.allowed_driver_ids && v.allowed_driver_ids.includes(personId)))
})

const availableVehicles = computed(() => {
  return suggestedVehicles.value.filter((v: any) => {
    const p = v.plate || ''
    if (p.includes('🚶') || p.toLowerCase().includes('пеш')) return false
    if (selectedVehicle.value && String(v.id) === String(selectedVehicle.value.id)) return false
    return true
  })
})

// --- ПОПУТЧИКИ ---
const eligibleCompanions = computed(() => {
  if (!props.selectedItem || !canStartTrip.value) return []
  return getEligibleCompanions(props.selectedItem, tripPassengers.value, props.peopleList, props.processedJournal)
})

const availableRelatives = computed(() => {
  if (!props.selectedItem || props.selectedItem.type !== 'person') return []
  const myRoot = getFamilyRoot(props.selectedItem, props.peopleList)
  if (!myRoot) return []
  return eligibleCompanions.value.filter((p: any) => {
    const theirRoot = getFamilyRoot(p, props.peopleList)
    return theirRoot && theirRoot.id === myRoot.id
  })
})

const selectedItemFamilyMap = computed(() => {
  const map = new Map<string, string>()
  if (!props.selectedItem || props.selectedItem.type !== 'person') return map
  const familyMembers = getFullFamily(props.selectedItem, props.peopleList)
  if (familyMembers && Array.isArray(familyMembers)) {
    familyMembers.forEach((member: any) => {
      if (member.id && member.relation) {
        map.set(String(member.id), member.relation)
      }
    })
  }
  return map
})

const getRelationLabel = (person: any) => {
  if (!person || !props.selectedItem) return ''
  return selectedItemFamilyMap.value.get(String(person.id)) || ''
}

const allowedCompanions = computed(() => eligibleCompanions.value.map(p => ({ item: p })))
const showAddSection = computed(() => availableVehicles.value.length > 0 || availableRelatives.value.length > 0)
const canJoinTrip = (person: any) => canPhysicallyJoin(getPersonLocationStatus(person, props.processedJournal), actualStatus.value)
const getPersonStatusTextLocal = (person: any) => getPersonStatusText(getPersonLocationStatus(person, props.processedJournal))

// --- ВАЛИДАЦИЯ ---
const hasAdultCompanion = computed(() => tripPassengers.value.some(p => isValidGuardianFor(props.selectedItem, p, props.peopleList)))
const hasAnyCompanion = computed(() => tripPassengers.value.length > 0)
const needsPermissionConfirmation = computed(() => personCategory.value === 'permission' && !hasAdultCompanion.value)
const needsEscortConfirmation = computed(() => personCategory.value === 'escort' && !hasAdultCompanion.value)
const needsChildSoloExitConfirmation = computed(() => personCategory.value === 'small' && (isResidentInside.value || isGuestInside.value) && !hasAdultCompanion.value)
const needsChildArrivalConfirmation = computed(() => personCategory.value === 'small' && (isResidentOutside.value || isGuestOutside.value) && !hasAnyCompanion.value)

const validationError = computed(() => {
  if (!props.selectedItem || !props.selectedItem.id) return 'Ошибка: Не выбран человек или отсутствует ID'
  const coreValidation = validateTrip(props.selectedItem, tripPassengers.value, props.peopleList, props.processedJournal)
  if (!coreValidation.isValid) return coreValidation.error
  if (!canStartTrip.value) return 'Действие недоступно'
  if (personCategory.value === 'small') {
    if (isResidentInside.value || isGuestInside.value) {
      if (!hasAdultCompanion.value && !childSoloExitConfirmed.value) return 'Ребёнок может выехать только с родственниками'
    }
    if (isResidentOutside.value || isGuestOutside.value) {
      if (!hasAnyCompanion.value && !childSoloArrivalConfirmed.value) return 'Подтвердите прибытие'
    }
  }
  if (needsPermissionConfirmation.value && !permissionConfirmed.value) return 'Подтвердите разрешение'
  if (needsEscortConfirmation.value && !escortSoloAllowed.value) return 'Разрешите выход одному или добавьте сопровождающего'
  return null
})

const isTripValid = computed(() => validationError.value === null)

const actionButtonLabel = computed(() => {
  if (isResidentInside.value || isGuestInside.value) return 'Выезд'
  if (isResidentOutside.value || isGuestOutside.value) return 'Въезд'
  return 'Действие'
})

const totalPeopleCount = computed(() => 1 + tripPassengers.value.length)

const walkingButtonLabel = computed(() => {
  const isExit = isResidentInside.value || isGuestInside.value
  const isEnter = isResidentOutside.value || isGuestOutside.value
  const isGuest = !isResident.value

  if (isExit) {
    const base = isGuest
      ? (totalPeopleCount.value > 1 ? 'Уехали' : 'Уехал')
      : (totalPeopleCount.value > 1 ? 'Вышли' : 'Вышел')
    return `${base} (${totalPeopleCount.value})`
  } else if (isEnter) {
    const base = isGuest
      ? (totalPeopleCount.value > 1 ? 'Пришли' : 'Пришёл')
      : (totalPeopleCount.value > 1 ? 'Вошли' : 'Вошел')
    return `${base} (${totalPeopleCount.value})`
  }
  return `Действие (${totalPeopleCount.value})`
})

// --- ДЕЙСТВИЯ ---
const getPassengerClass = (p: any) => (canJoinTrip(p.item || p) ? 'cursor-pointer hover:badge-primary' : 'opacity-50 cursor-not-allowed')

// [UI/UX] alert -> warning-тост с именем
const tryAddPassenger = (p: any) => {
  const person = p.item || p
  if (!canJoinTrip(person)) {
    toast.warning(`Нельзя добавить: ${person.fio} — не в той локации`)
    return
  }
  tripPassengers.value.push(person)
  passengerSearchQuery.value = ''
  foundPassengers.value = []
}

const selectVehicle = (v: any) => { selectedVehicle.value = v }
const deselectVehicle = () => { selectedVehicle.value = null }
const removePassenger = (p: any) => { tripPassengers.value = tripPassengers.value.filter(item => item.id !== p.id) }
const clearNote = () => { tripNote.value = '' }
const handleNoteBlur = () => { if (!tripNote.value) isEditingNote.value = false }

const clearSearch = () => {
  globalSearch.value = ''
  isSearchFocused.value = false
  activeDropdownIndex.value = -1
  selectingDriverForVehicle.value = null
  potentialDrivers.value = []
  pendingPassengerToAdd.value = null
  selectedVehicle.value = null
  tripPassengers.value = []
  tripDestination.value = 'Город'
  isEditingNote.value = false
  passengerSearchQuery.value = ''
  foundPassengers.value = []
  permissionConfirmed.value = false
  escortSoloAllowed.value = false
  childSoloArrivalConfirmed.value = false
  childSoloExitConfirmed.value = false
}

const handleDeselect = () => {
  emit('update:selectedItem', null)
  globalSearch.value = ''
  isSearchFocused.value = false
}

const handlePassengerBlur = () => { setTimeout(() => { foundPassengers.value = [] }, 200) }
const handlePassengerFocus = () => { if (!passengerSearchQuery.value) foundPassengers.value = allowedCompanions.value }
const handlePassengerSearch = () => {
  if (passengerSearchQuery.value.length < 2) {
    foundPassengers.value = allowedCompanions.value
    return
  }
  const addedIds = tripPassengers.value.map(p => p.id)
  foundPassengers.value = fusePeople.value.search(passengerSearchQuery.value).filter((r: any) => r.item.id !== props.selectedItem?.id && !addedIds.includes(r.item.id))
}

const handlePassengerWheel = (e: WheelEvent) => {
  if (!foundPassengers.value.length || !passengerListEl.value) return
  e.preventDefault()
  passengerListEl.value.scrollTop += e.deltaY > 0 ? 30 : -30
}

// --- ЛОГИКА ВЫБОРА ---
const selectItem = async (item: any) => {
  isSearchFocused.value = false
  isSelecting.value = true

  if (item.type === 'vehicle') {
    const drivers = (item.allowed_driver_ids && item.allowed_driver_ids.length > 0) ? item.allowed_driver_ids : (item.owner_id ? [item.owner_id] : [])
    const driverPeople = props.peopleList.filter((p: any) => drivers.includes(p.id))

    if (driverPeople.length === 0) {
      // [UI/UX] alert -> error-тост
      toast.error('У этого автомобиля нет зарегистрированных водителей')
      clearSearch()
      return
    }

    const currentPerson = props.selectedItem && props.selectedItem.type === 'person' ? props.selectedItem : null

    if (currentPerson) {
      if (drivers.includes(currentPerson.id)) {
        finalizeSelection(currentPerson, item)
        return
      }
      pendingPassengerToAdd.value = currentPerson
    }

    if (driverPeople.length === 1) {
      const single = driverPeople[0]
      if (single) finalizeSelection(single, item)
    } else {
      selectingDriverForVehicle.value = item
      potentialDrivers.value = driverPeople
      return
    }
  }
  else if (item.type === 'person') {
    finalizeSelection(item, null)
  }
}

const finalizeSelection = (person: any, vehicle: any | null) => {
  if (!person || !person.id) {
    console.error('[JournalSidebar] finalizeSelection: У человека нет ID!', person)
    return
  }

  const finalPerson = { ...person, type: 'person' }

  if (vehicle) {
    const allowedIds = vehicle.allowed_driver_ids || (vehicle.owner_id ? [vehicle.owner_id] : [])
    if (!allowedIds.includes(finalPerson.id)) {
      // [UI/UX] alert -> error-тост
      toast.error(`⛔ ${finalPerson.fio} не допущен к управлению данным автомобилем`)
      selectedVehicle.value = null
      emit('update:selectedItem', finalPerson)
      globalSearch.value = finalPerson.display
      selectingDriverForVehicle.value = null
      potentialDrivers.value = []
      return
    }
  }

  emit('update:selectedItem', finalPerson)

  selectedVehicle.value = null
  tripPassengers.value = []
  tripDestination.value = 'Город'
  isEditingNote.value = false
  passengerSearchQuery.value = ''
  foundPassengers.value = []
  permissionConfirmed.value = false
  escortSoloAllowed.value = false
  childSoloArrivalConfirmed.value = false
  childSoloExitConfirmed.value = false

  if (vehicle) selectedVehicle.value = vehicle

  if (pendingPassengerToAdd.value && pendingPassengerToAdd.value.id !== finalPerson.id) {
    if (!tripPassengers.value.find((p: any) => p.id === pendingPassengerToAdd.value.id)) {
      tripPassengers.value.push(pendingPassengerToAdd.value)
    }
    pendingPassengerToAdd.value = null
  }

  globalSearch.value = finalPerson.display
  selectingDriverForVehicle.value = null
  potentialDrivers.value = []
}

const selectDriver = (person: any) => {
  const vehicle = selectingDriverForVehicle.value
  finalizeSelection(person, vehicle)
}

// --- ОБРАБОТЧИКИ КНОПОК ---
const handleWalkingTrip = () => {
  if (!isTripValid.value) {
    // [UI/UX] вместо console.warn — warning-тост с текстом валидации
    toast.warning(validationError.value || 'Действие недоступно')
    return
  }
  if (!props.selectedItem || !props.selectedItem.id) {
    toast.error('Критическая ошибка: не выбран человек или отсутствует ID')
    return
  }

  const approvedSolo = (needsEscortConfirmation.value && escortSoloAllowed.value) || (needsChildSoloExitConfirmation.value && childSoloExitConfirmed.value)
  const payloadBase = {
    destination: tripDestination.value,
    note: tripNote.value,
    permissionConfirmed: permissionConfirmed.value,
    approvedSolo,
    childSoloArrival: childSoloArrivalConfirmed.value
  }
  const actionKey = (isResidentInside.value || isGuestInside.value) ? 'exit' : 'enter'

  if (tripPassengers.value.length > 0) {
    emit('group-action', {
      type: 'group',
      actionKey,
      vehicle: null,
      passengers: tripPassengers.value,
      mainPerson: props.selectedItem,
      ...payloadBase
    })
  } else {
    emit('action', {
      type: 'single',
      actionKey,
      transportType: 'foot',
      person: props.selectedItem,
      ...payloadBase
    })
  }
  clearSearch()
}

const handleGroupTrip = () => {
  if (!selectedVehicle.value || !isTripValid.value) {
    // [UI/UX] вместо молчаливого return — объяснение
    toast.warning(validationError.value || 'Выберите автомобиль')
    return
  }
  if (!props.selectedItem || !props.selectedItem.id) return

  const approvedSolo = (needsEscortConfirmation.value && escortSoloAllowed.value) || (needsChildSoloExitConfirmation.value && childSoloExitConfirmed.value)
  const actionKey = (isResidentInside.value || isGuestInside.value) ? 'exit' : 'enter'

  emit('group-action', {
    type: 'group',
    actionKey,
    vehicle: selectedVehicle.value,
    passengers: tripPassengers.value,
    destination: tripDestination.value,
    note: tripNote.value,
    mainPerson: props.selectedItem,
    approvedSolo
  })
  clearSearch()
}

watch(globalSearch, (newVal) => {
  if (isSelecting.value) { isSelecting.value = false; return }
  activeDropdownIndex.value = -1
})

watch(() => props.selectedItem, (newVal) => {
  if (!newVal) {
    isSearchFocused.value = false
  }
  selectedVehicle.value = null
  tripPassengers.value = []
  tripDestination.value = 'Город'
  isEditingNote.value = false
  passengerSearchQuery.value = ''
  foundPassengers.value = []
  permissionConfirmed.value = false
  escortSoloAllowed.value = false
  childSoloArrivalConfirmed.value = false
  childSoloExitConfirmed.value = false
})

onMounted(() => {
  nextTick(() => {
    globalSearchInput.value?.focus()
  })
})
</script>

<style scoped>
.search-results-enter-active { animation: down-slide 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
.search-results-leave-active { animation: down-slide 0.2s cubic-bezier(0.4, 0, 1, 1) reverse; }
@keyframes down-slide {
  from { opacity: 0; transform: translateY(-5px) scale(0.99); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.slide-fade-enter-active { transition: all 0.2s ease-out; }
.slide-fade-leave-active { transition: all 0.15s cubic-bezier(1, 0.5, 0.8, 1); }
.slide-fade-enter-from, .slide-fade-leave-to { transform: translateY(-10px); opacity: 0; }
</style>