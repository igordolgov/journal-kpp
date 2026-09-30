<!-- app\components\ShiftManager.vue -->
<template lang='pug'>
  .shift-display.flex.items-center.gap-2.text-sm.ml-1
    template(v-if='currentShift')
      //- ЕСЛИ НА ПЕРЕРЫВЕ
      template(v-if='isOnBreak')
        .badge.badge-warning.rounded-lg.gap-1
          | ☕ Перерыв
        span.text-xs.text-gray-500
          | ({{ actingGuardName }})
      
      //- ЕСЛИ НА ПОСТУ
      template(v-else)
        .p-1.pr-2.rounded-full(class="bg-green-400/20")
          | 🟢 {{ currentShift.guard_name }}
        span.text-xs.text-gray-500
          | (с {{ formatTime(currentShift.start_time) }})
      
      .dropdown.dropdown-end
        label.btn.btn-ghost.btn-xs(tabindex='0')
          | ⋮
        ul.dropdown-content.menu.p-2.shadow.bg-base-100.rounded-box.w-52(tabindex='0')
          li(v-if='!isOnBreak')
            a(@click='openBreakModal')
              span ☕ Уйти на перерыв
          li(v-else)
            a(@click='handleEndBreak')
              span ✅ Вернуться
          li.border-t.border-base-200
            a.text-error(@click='openEndShiftModal')
              span 🏁 Сдать смену

    template(v-else)
      button.btn.btn-success.btn-xs(@click='openStartModal')
        | 👮‍♂️ Принять смену
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useShift } from '../composables/useShift';

// Получаем все нужные данные из useShift
const { 
  currentShift, 
  isOnBreak, 
  actingGuardName, 
  endBreak 
} = useShift();

const isStartModalOpen = useState('shift-start-modal', () => false);
const isEndModalOpen = useState('shift-end-modal', () => false);
const isBreakModalOpen = useState('shift-break-modal', () => false);

const guardNameInput = ref('');
const breakCoverName = ref('');

const formatTime = (ts: number) => {
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};

const openStartModal = () => { guardNameInput.value = ''; isStartModalOpen.value = true; };
const openEndShiftModal = () => { isEndModalOpen.value = true; };
const openBreakModal = () => { breakCoverName.value = ''; isBreakModalOpen.value = true; };

const handleEndBreak = async () => {
  await endBreak();
  alert('Вернулись с перерыва');
};
</script>
