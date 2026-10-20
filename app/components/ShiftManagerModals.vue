<!-- app\components\ShiftManagerModals.vue -->
<template lang='pug'>
  //- Модалка: Начало смены
  dialog.modal(class="modal-open" v-if='isStartModalOpen')
    .modal-box
      h3.font-bold.text-lg Принятие смены
      .form-control.mt-4
        label.label ФИО Охранника
        input.input.input-bordered(v-model='guardNameInput' placeholder='Иванов И.И.' list='guard-names')
        //- [UX] ранее принятые смены подсказываются в выпадающем списке
        datalist#guard-names
          option(v-for='g in guardSuggestions' :key='g' :value='g')
      .modal-action
        button.btn.btn-ghost(@click='isStartModalOpen = false') Отмена
        button.btn.btn-primary(@click='handleStart') Принять

  //- Модалка: Конец смены
  dialog.modal(class="modal-open" v-if='isEndModalOpen')
    .modal-box
      h3.font-bold.text-lg Сдача смены
      .form-control.mt-4
        label.label Примечание (передача ключей, замечания)
        textarea.textarea.textarea-bordered(v-model='endNotes')
      .modal-action
        button.btn.btn-ghost(@click='isEndModalOpen = false') Отмена
        button.btn.btn-error(@click='handleEnd') Сдать смену

  //- Модалка: Перерыв
  dialog.modal(class="modal-open" v-if='isBreakModalOpen')
    .modal-box
      h3.font-bold.text-lg Уход на перерыв
      .form-control.mt-4
        label.label Кто заменяет? (необязательно)
        input.input.input-bordered(v-model='breakCoverName' placeholder='Петров П.П.')
      .modal-action
        button.btn.btn-ghost(@click='isBreakModalOpen = false') Отмена
        button.btn.btn-warning(@click='handleBreak') Уйти

  //- Расчётный лист закрытой смены (этап 7)
  PayrollPayslip(:open='payslipOpen' :summary='payslipSummary' :shift='payslipShift' @close='payslipOpen = false')
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useShift } from '../composables/useShift';
import { usePayroll } from '~/composables/usePayroll';
import { useDatabase } from '~/composables/useDatabase';
import type { PayrollShiftSummary } from '~/types/payroll';

const { currentShift, startShift, endShift, startBreak } = useShift();

// Подключаемся к тем же состояниям модалок
const isStartModalOpen = useState('shift-start-modal');
const isEndModalOpen = useState('shift-end-modal');
const isBreakModalOpen = useState('shift-break-modal');

// Локальные переменные для форм
const guardNameInput = ref('');
const endNotes = ref('');
const breakCoverName = ref('');

// [UX] запоминание дежурных: ФИО из истории смен предлагаются при
// принятии смены (datalist). Источник — store 'shifts': имя попадает
// туда уже при старте смены, поэтому подсказка работает и для смен,
// которые ещё не закрыты (и не имеют расчётного листа).
const { getAllItems } = useDatabase();
const guardSuggestions = ref<string[]>([]);
const loadGuardSuggestions = async () => {
  try {
    const shifts = await getAllItems('shifts');
    const byRecency = new Map<string, number>();
    for (const s of shifts || []) {
      const name = String(s.guard_name || '').trim();
      if (!name) continue;
      const started = Number(s.start_time) || 0;
      byRecency.set(name, Math.max(byRecency.get(name) ?? 0, started));
    }
    guardSuggestions.value = [...byRecency.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name]) => name);
  } catch (e) {
    console.error('[ShiftManagerModals] не удалось загрузить дежурных', e);
  }
};
// Обновляем список каждый раз при открытии модалки — за сессию могли
// принять смены под новыми ФИО
watch(isStartModalOpen, (open) => { if (open) loadGuardSuggestions(); }, { immediate: true });

const handleStart = async () => {
  if (!guardNameInput.value.trim()) return alert('Введите ФИО');
  await startShift(guardNameInput.value);
  isStartModalOpen.value = false;
};

// [PAYROLL] Расчётный лист (этап 7): снапшот смены берём ДО endShift —
// endShift обнуляет currentShift. Сводку считаем ПОСЛЕ закрытия: проводки
// живут в движке независимо от активной смены (getShiftSummary(shiftId)).
// При выключенной оплате — прежнее поведение (alert), лист был бы пустым шумом.
const payslipOpen = ref(false);
const payslipSummary = ref<PayrollShiftSummary | null>(null);
const payslipShift = ref<{ guard_name?: string; start_time?: number; end_time?: number | null; notes?: string | null } | null>(null);

const handleEnd = async () => {
  const snapshot = currentShift.value ? { ...currentShift.value } : null;
  await endShift(endNotes.value);
  isEndModalOpen.value = false;
  if (snapshot && snapshot.id != null) {
    const payroll = usePayroll();
    await payroll.init(); // идемпотентно: гарантирует конфиг и проводки в памяти
    if (payroll.config.value.enabled) {
      payslipSummary.value = payroll.getShiftSummary(snapshot.id);
      payslipShift.value = { ...snapshot, end_time: Date.now(), notes: endNotes.value || null };
      payslipOpen.value = true;
      return;
    }
  }
  alert('Смена сдана!');
};

const handleBreak = async () => {
  await startBreak(breakCoverName.value || null);
  isBreakModalOpen.value = false;
};
</script>