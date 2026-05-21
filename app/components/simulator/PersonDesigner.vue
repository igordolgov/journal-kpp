<!-- app/components/simulator/PersonDesigner.vue -->
<template lang="pug">
div(
  class="designer-container h-screen w-screen flex flex-col bg-base-300 text-base-content overflow-hidden"
)
  header(
    class="h-12 flex items-center justify-between px-4 bg-base-100 border-b border-base-300 flex-shrink-0 shadow-md"
  )
    .flex.items-center.gap-3
      h1.text-sm.font-semibold.tracking-wide 
        | 👤 КОНСТРУКТОР ПЕРСОНАЖЕЙ
    
    .flex.gap-2
      button(
        class="btn btn-sm btn-ghost border border-base-300 hover:bg-base-200"
        @click="generatePool"
        v-if="!isEditMode"
      )
        | ➕ Генератор (5 шт)
      button(
        class="btn btn-sm btn-ghost text-error border border-error/30 hover:bg-error/30"
        @click="clearPool"
        v-if="!isEditMode"
      )
        | 🗑 Очистить
      button(
        class="btn btn-sm btn-primary px-6"
        @click="handleSave"
      )
        | 💾 Сохранить

  div(
    class="flex-1 min-h-0 flex overflow-hidden"
  )
    
    aside(
      class="w-auto bg-base-100 border-r border-base-300 flex flex-col flex-shrink-0 bg-base-100/50"
    )
      .p-3.border-b.border-base-300.bg-base-100
        h3.text-xs.font-semibold.uppercase(class="text-base-content/80") Пулл персонажей
      
      div(
        class="flex-1 overflow-y-auto p-2"
      )
        .grid.grid-cols-2.gap-2
          .pool-item.relative.cursor-pointer.rounded-lg.border-2.group(
            v-for="(person, index) in characterPool"
            :key="person.id"
            :class="'transition-all duration-200 ' + (selectedId === person.id ? 'border-primary bg-base-200/50 shadow-lg shadow-primary/10' : 'border-base-300/50 bg-base-300 hover:border-base-content/20')"
            @click="selectPerson(person)"
          )
            .flex.justify-center.pt-2.pb-1
              PersonAvatar(
                :appearance="person"
                :width="40"
                :height="80"
                view="front"
              )
            .text-xxs.text-center.font-medium.pb-2.truncate.px-2(class="text-base-content/80")
              | {{ person.name || 'Без имени' }}
            
            button(
              class="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full text-transparent bg-error/0 group-hover:bg-error/80 group-hover:text-base-content transition-all",
                @click.stop="removeFromPool(index)"
                v-if="!isEditMode"
            )
              span.text-xs ✕

    main(
      class="flex-1 flex flex-col items-center justify-center overflow-hidden relative",
      style="background: radial-gradient(circle at 50% 80%, oklch(var(--b2)) 0%, oklch(var(--b3)) 100%)"
    )
      .bg-base-100.rounded-lg.p-2.border.border-base-300.shadow-sm
          h4.text-sm.font-semibold.text-gray-500.uppercase.mb-2 Фон превью
          .grid.grid-cols-5.gap-2.mb-2

          ColorPicker(v-model="avatarBgColor" :palette="['#f5f5f4', '#94a3b8', '#475569', '#1e293b', '#000000']")
      div(
        class="absolute bottom-0 left-0 right-0 pointer-events-none h-1/3 bg-gradient-to-t from-base-100/50 to-transparent"
      )
      
      template(v-if="selectedPerson")
        .mb-2.text-center.z-10
          input(
            class="input input-lg bg-transparent border-none text-2xl font-bold text-center text-base-content w-96 focus:bg-base-200/50 rounded-lg",
            v-model="selectedPerson.name"
            placeholder="Введите имя..."
          )
        
        .flex.gap-12.items-end.z-10
          .text-center.group
            .text-xs.text-gray-400.mb-2.uppercase Спереди
            div(
              class="flex items-center justify-center p-6 rounded-2xl shadow-2xl border border-base-300/50 backdrop-blur-sm transition-transform group-hover:scale-105",
              :style="{ backgroundColor: avatarBgColor }"
            )
              PersonAvatar(
                :appearance="selectedPerson"
                :width="150"
                :height="300"
                view="front"
                :is-moving="isWalking"
              )
          
          .text-center.group
            .text-xs.text-gray-400.mb-2.uppercase Сзади
            div(
              class="flex items-center justify-center p-6 rounded-2xl shadow-2xl border border-base-300/50 backdrop-blur-sm transition-transform group-hover:scale-105",
              :style="{ backgroundColor: avatarBgColor }"
            )
              PersonAvatar(
                :appearance="selectedPerson"
                :width="150"
                :height="300"
                view="back"
                :is-moving="isWalking"
              )

        .flex.items-center.justify-between.gap-4.mt-6.z-10
          button.btn.no-animation(
            :class="isWalking ? 'btn-warning' : 'btn-success'"
            @click="isWalking = !isWalking"
          )
            | {{ isWalking ? '⏹ Стоп' : '▶ Ходьба' }}
          
          .grid.grid-cols-3.gap-x-5
            .form-control
              label.text-sm.text-gray-500.flex.justify-between
                span Скорость
                span.font-mono.text-primary {{ selectedPerson?.animation?.speed?.toFixed(1) || '1.0' }}
              input.range.range-xs.range-primary.w-full(type="range" min="0.5" max="2" step="0.1" v-model.number="selectedPerson.animation.speed")
            .form-control
              label.text-sm.text-gray-500.flex.justify-between
                span Размах
                span.font-mono.text-primary {{ selectedPerson?.animation?.swingAmplitude || 5 }}
              input.range.range-xs.range-primary.w-full(type="range" min="0" max="10" step="1" v-model.number="selectedPerson.animation.swingAmplitude")
            .form-control
              label.text-sm.text-gray-500.flex.justify-between
                span Подскок
                span.font-mono.text-primary {{ selectedPerson?.animation?.bounceAmplitude || 3 }}
              input.range.range-xs.range-primary.w-full(type="range" min="0" max="8" step="1" v-model.number="selectedPerson.animation.bounceAmplitude")
      
      .text-gray-500.text-center.z-10(v-else)
        p.text-6xl.mb-4.opacity-30 🧍
        p.text-lg Выберите или создайте персонажа слева

    aside(
      class="w-200 bg-base-100 border-l border-base-300 flex flex-col flex-shrink-0",
      v-if="selectedPerson"
    )
      .flex-1.min-h-0.overflow-y-auto.p-3.space-y-2(class="bg-base-200/50")
        .bg-base-100.rounded-lg.p-2.border.border-base-300.shadow-sm
          h4.text-sm.font-semibold.text-gray-500.uppercase.mb-2 Тело
          .grid.grid-cols-2.gap-5
            select.select.select-xs.bg-base-200.w-full(v-model="selectedPerson.gender")
              option(value="male") Мужчина
              option(value="female") Женщина
            select.select.select-xs.bg-base-200.w-full(v-model="selectedPerson.ageGroup")
              option(value="adult") Взрослый
              option(value="child") Ребенок
              option(value="elder") Пожилой
            div
              label.text-sm.text-gray-500.flex.justify-between
                span Ширина тела
                span.font-mono.text-primary {{ (selectedPerson?.bodyWidth || 1).toFixed(2) }}
              input.range.range-xs.range-primary.w-full(type="range" min="0.8" max="1.2" step="0.05" v-model.number="selectedPerson.bodyWidth")
            div
              label.text-sm.text-gray-500.flex.justify-between
                span Ширина лица
                span.font-mono.text-primary {{ (selectedPerson?.faceWidth || 1).toFixed(2) }}
              input.range.range-xs.range-primary.w-full(type="range" min="0.8" max="1.2" step="0.05" v-model.number="selectedPerson.faceWidth")

        .bg-base-100.rounded-lg.p-2.border.border-base-300.shadow-sm
          h4.text-sm.font-semibold.text-gray-500.uppercase.mb-2 Голова
          .grid.grid-cols-2.gap-5
            .form-control
              label.text-sm.text-gray-500.mb-1.block Кожа
              ColorPicker(v-model="selectedPerson.skinTone" :palette="PALETTES.skin")
            .form-control
              label.text-sm.text-gray-500.mb-1.block Глаза
              ColorPicker(v-model="selectedPerson.eyeColor" :palette="PALETTES.eyes")
            .flex
              .form-control
                label.text-sm.text-gray-500.mb-1 Прическа
                select.select.select-xs.bg-base-200.w-full(v-model="selectedPerson.hairStyleId")
                  option(value="short") Короткая
                  option(value="long" v-if="selectedPerson?.gender === 'female'") Длинная
                  option(value="ponytail" v-if="selectedPerson?.gender === 'female'") Хвост
                  option(value="bun" v-if="selectedPerson?.gender === 'female'") Пучок
                  option(value="mohawk" v-if="selectedPerson?.gender === 'male'") Ирокез
                  option(value="bald" v-if="selectedPerson?.gender === 'male'") Лысый
              .form-control.ml-auto(v-if="selectedPerson?.gender === 'male' && selectedPerson?.hairStyleId !== 'bald'")
                label.text-sm.text-gray-500.mb-1.block Залысины
                input.toggle.toggle-xs.toggle-primary(type="checkbox" v-model="selectedPerson.hasRecedingHairline")
            .form-control(v-if="selectedPerson?.hairStyleId !== 'bald'")
              label.text-sm.text-gray-500.mb-1.block Волосы
              ColorPicker(v-model="selectedPerson.hairColor" :palette="PALETTES.hair")
            .form-control(v-if="selectedPerson?.gender === 'male'")
              label.text-sm.text-gray-500.mb-1.block Волосы на лице
              select.select.select-xs.bg-base-200.w-full(v-model="selectedPerson.facialHair")
                option(value="none") Нет
                option(value="stubble") Щетина
                option(value="mustache") Усы
                option(value="beard") Борода
                option(value="goatee") Козлик
            .form-control
              label.text-sm.text-gray-500.mb-1.block Убор
              select.select.select-xs.bg-base-200.w-full(v-model="selectedPerson.headwear")
                option(value="none") Нет
                option(value="cap" v-if="selectedPerson?.gender === 'male'") Кепка
                option(value="hat") Шляпа
                option(value="beanie") Шапка
            .form-control
              label.text-sm.text-gray-500.mb-1.block Очки
              select.select.select-xs.bg-base-200.w-full(v-model="selectedPerson.glasses")
                option(value="none") Нет
                option(value="glasses") Прямые
                option(value="round") Круглые
                option(value="sunglasses") Солнце
            .form-control(v-if="selectedPerson?.headwear !== 'none'")
              label.text-sm.text-gray-500.mb-1.block Цвет убора
              ColorPicker(v-model="selectedPerson.headwearColor" :palette="PALETTES.hats" :default-color="'#1e293b'")

        .bg-base-100.rounded-lg.p-2.border.border-base-300.shadow-sm
          h4.text-sm.font-semibold.text-gray-500.uppercase.mb-2 Одежда
          .grid.grid-cols-2.gap-5.mb-4
            .form-control
              label.text-sm.text-gray-500.mb-1.block Стиль
              select.select.select-xs.bg-base-200.w-full(v-model="selectedPerson.clothingStyle")
                option(value="standard") Стандарт
                option(value="hoodie") Худи
                option(value="skirt" v-if="selectedPerson?.gender === 'female'") Юбка
                option(value="dress" v-if="selectedPerson?.gender === 'female'") Платье
                option(value="suit" v-if="selectedPerson?.gender === 'male'") Костюм
          .grid.grid-cols-2.gap-5
            .form-control
              label.text-sm.text-gray-500.mb-1.block Верх
              ColorPicker(v-model="selectedPerson.topColor" :palette="PALETTES.clothes.tops")
            .form-control(v-if="selectedPerson?.clothingStyle !== 'dress'")
              label.text-sm.text-gray-500.mb-1.block {{ ['skirt', 'dress'].includes(selectedPerson?.clothingStyle) ? 'Ноги' : 'Низ' }}
              ColorPicker(v-model="selectedPerson.bottomColor" :palette="PALETTES.clothes.bottoms")
            .form-control(v-if="selectedPerson?.clothingStyle === 'skirt'")
              label.text-sm.text-gray-500.mb-1.block Юбка
              ColorPicker(v-model="selectedPerson.skirtColor" :palette="PALETTES.clothes.bottoms")
            .form-control
              label.text-sm.text-gray-500.mb-1.block Обувь
              ColorPicker(v-model="selectedPerson.shoeColor" :palette="PALETTES.shoes")
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import PersonAvatar from './PersonAvatar.vue'
import ColorPicker from '../ui/ColorPicker.vue'
import { usePersonGenerator } from '~/composables/usePersonGenerator'

const { createRandomPerson, PALETTES } = usePersonGenerator()

const props = defineProps<{ initialPerson?: any }>()
const emit = defineEmits(['save'])

const characterPool = ref<any[]>([])
const selectedId = ref<string | null>(null)
const isWalking = ref(false)

// Цвет фона под аватарками
const avatarBgColor = ref('#475569')

const isEditMode = computed(() => !!props.initialPerson)
const selectedPerson = computed(() => {
  return characterPool.value.find(p => p.id === selectedId.value)
})

// Вспомогательная функция для безопасной записи примитивов (числа, строки) через v-model
const setVal = (prop: string, event: any) => {
  if (!selectedPerson.value) return;
  const val = parseFloat(event.target.value);
  selectedPerson.value[prop] = val;
}

// Генерация случайного цвета (для инициализации, чтобы не было undefined)
const getRandomColor = (palette: string[]) => palette[Math.floor(Math.random() * palette.length)];

watch(
  () => selectedPerson.value?.gender,
  (newGender, oldGender) => {
    if (!selectedPerson.value || !oldGender) return
    const style = selectedPerson.value.clothingStyle
    // Мужчина не может носить юбку и платье
    if (newGender === 'male' && ['skirt', 'dress'].includes(style)) {
      selectedPerson.value.clothingStyle = 'standard'
      if (style === 'skirt' && PALETTES?.clothes?.bottoms?.length) {
        selectedPerson.value.bottomColor = getRandomColor(PALETTES.clothes.bottoms);
      }
    }
    // Женщина не может носить костюм
    if (newGender === 'female' && style === 'suit') {
      selectedPerson.value.clothingStyle = 'standard'
    }

    if (newGender === 'male' && selectedPerson.value.hairStyleId === 'bald') {
      if (PALETTES?.hair?.length) {
        selectedPerson.value.hairColor = getRandomColor(PALETTES.hair);
      }
    }
  }
)

// Жесткая нормализация для защиты от старых данных в БД
const normalizePerson = (p: any) => {
  if (!p.ageGroup) p.ageGroup = 'adult'
  if (!p.eyeColor) p.eyeColor = '#4A5D23' 
  if (!p.glasses) p.glasses = 'none'
  if (!p.facialHair) p.facialHair = 'none'
  if (!p.headwear) p.headwear = 'none'
  if (!p.clothingStyle) p.clothingStyle = 'standard'
  if (!p.bodyWidth) p.bodyWidth = 1.0       
  if (!p.skirtColor) p.skirtColor = '#64748b' 
  if (!p.shoeColor) p.shoeColor = '#1f2937'   
  if (!p.bottomColor) p.bottomColor = '#1e293b'
  if (p.hasRecedingHairline === undefined) p.hasRecedingHairline = false
  if (p.gender === 'male' && ['long', 'ponytail', 'bun'].includes(p.hairStyleId)) {
    p.hairStyleId = 'short';
  }
  if (p.gender === 'female' && p.hairStyleId === 'mohawk' && p.ageGroup !== 'child') {
    p.hairStyleId = 'short';
  }
  // ---------------------------

  if (!p.animation || typeof p.animation !== 'object') {
    p.animation = { speed: 1, swingAmplitude: 5, bounceAmplitude: 3, armSwing: 15 }
  }
  return p
}

onMounted(() => {
  if (props.initialPerson) {
    const cloned = normalizePerson(JSON.parse(JSON.stringify(props.initialPerson)))
    if (!cloned.faceWidth) cloned.faceWidth = 1.0
    characterPool.value = [cloned]
    selectedId.value = cloned.id
  } else {
    generatePool()
  }
})

const generatePool = () => {
  const batch = Array.from({ length: 5 }, () => normalizePerson(createRandomPerson()))
  characterPool.value = [...batch, ...characterPool.value]
  if (!selectedId.value) selectedId.value = batch[0].id
}

const clearPool = () => {
  characterPool.value = []
  selectedId.value = null
}

const selectPerson = (person: any) => {
  selectedId.value = person.id
  isWalking.value = false
}

const removeFromPool = (index: number) => {
  const removed = characterPool.value.splice(index, 1)
  if (removed[0]?.id === selectedId.value) {
    selectedId.value = characterPool.value[0]?.id || null
  }
}

const handleSave = () => {
  if (!selectedPerson.value) return

  const safeClone = JSON.parse(JSON.stringify(selectedPerson.value, (key, value) => {
    if (typeof value === 'function') return undefined
    return value
  }))

  emit('save', safeClone)
}
</script>