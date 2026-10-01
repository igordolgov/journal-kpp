<!-- app/components/ui/OnboardingTour.vue -->
<!-- Назначение: тур первого запуска — 4 слайда о назначении программы.
    Показывается один раз (localStorage 'kpp-onboarding-done'), повтор —
    из Настроек через useOnboarding().show(). -->
<template lang="pug">
transition(name="fade")
  .fixed.inset-0.z-80.flex.items-center.justify-center.p-4(
    v-if="isOpen"
    class="bg-black/70 backdrop-blur-sm"
  )
    .card.w-full.max-w-lg.bg-base-100.shadow-2xl
      .card-body.p-6

        //- Прогресс-точки
        .flex.justify-center.gap-2.mb-4
          button.btn.btn-xs.btn-circle(
            v-for="(s, i) in slides"
            :key="i"
            :class="i === step ? 'btn-primary' : 'btn-ghost border border-base-300'"
            @click="step = i"
            :aria-label="`Шаг ${i + 1}`"
          )

        //- Слайды
        .min-h-56
          //- Слайд 1: Что это
          template(v-if="step === 0")
            .text-5xl.text-center.mb-4 🛂
            h2.text-2xl.font-bold.text-center Журнал КПП
            p.mt-3.text-center(class="text-base-content/70")
              | Учёт въезда и выезда людей и транспорта на объект.
              | Работает полностью офлайн — все данные хранятся
              | только на этом устройстве.

          //- Слайд 2: Журнал — главный экран
          template(v-if="step === 1")
            .text-5xl.text-center.mb-4 📝
            h2.text-2xl.font-bold.text-center Журнал — главный экран
            p.mt-3.text-center(class="text-base-content/70")
              | Поездка оформляется в панели слева:
              | найдите человека или автомобиль по госномеру —
              | и нажмите «Вышел» или «Вошёл».
            //- Мини-схема: три шага
            .flex.items-center.justify-center.gap-2.mt-4.text-xs
              .badge.badge-primary 1. Найти
              span.opacity-40 →
              .badge.badge-primary 2. Нажать
              span.opacity-40 →
              .badge.badge-primary 3. Готово
            p.mt-3.text-center.text-sm(class="text-base-content/50")
              | Всё остальное — история поездок в таблице справа.

          //- Слайд 3: База данных
          template(v-if="step === 2")
            .text-5xl.text-center.mb-4 👥
            h2.text-2xl.font-bold.text-center База данных
            p.mt-3.text-center(class="text-base-content/70")
              | Жители, гости, семьи и их автомобили заводятся здесь.
              | Карточки из базы появляются в журнале и симуляторе.
              | Без записи в базе человека «не существует».

          //- Слайд 4: Симулятор
          template(v-if="step === 3")
            .text-5xl.text-center.mb-4 🎬
            h2.text-2xl.font-bold.text-center Симулятор
            p.mt-3.text-center(class="text-base-content/70")
              | Виртуальный КПП для тренировки: сценарии движения,
              | группы людей, звук ворот. Запускается кнопкой с камерой
              | в правом нижнем углу.

        //- Управление
        .flex.items-center.justify-between.mt-6
          button.btn.btn-ghost.btn-sm(
            type="button"
            @click="finish"
          ) Пропустить

          .flex.gap-2
            button.btn.btn-ghost.btn-sm(
              v-if="step > 0"
              type="button"
              @click="step--"
            ) Назад
            button.btn.btn-primary.btn-sm(
              type="button"
              @click="step < slides.length - 1 ? step++ : finish()"
            )
              | {{ step < slides.length - 1 ? 'Далее' : 'Начать работу' }}
</template>

<script setup lang="ts">
import { useOnboarding } from '~/composables/useOnboarding'

// Логика: показ/скрытие только в памяти (ref) — persist делает useOnboarding.
const isOpen = ref(false)
const step = ref(0)

const slides = ['Знакомство', 'Журнал', 'База данных', 'Симулятор']

const finish = () => {
  isOpen.value = false
  const { markDone } = useOnboarding()
  markDone()
}

// Показ тура извне (первый запуск / кнопка в настройках)
const { onShow } = useOnboarding()
onShow(() => {
  step.value = 0
  isOpen.value = true
})
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>