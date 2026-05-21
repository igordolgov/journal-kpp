<!-- app\components\ShiftManagerModals.vue -->
<template lang='pug'>
  //- Модалка: Начало смены
  dialog.modal(class="modal-open" v-if='isStartModalOpen')
    .modal-box
      h3.font-bold.text-lg Принятие смены
      .form-control.mt-4
        label.label ФИО Охранника
        input.input.input-bordered(v-model='guardNameInput' placeholder='Иванов И.И.')
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
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useShift } from '../composables/useShift';

const { startShift, endShift, startBreak } = useShift();

// Подключаемся к тем же состояниям модалок
const isStartModalOpen = useState('shift-start-modal');
const isEndModalOpen = useState('shift-end-modal');
const isBreakModalOpen = useState('shift-break-modal');

// Локальные переменные для форм
const guardNameInput = ref('');
const endNotes = ref('');
const breakCoverName = ref('');

const handleStart = async () => {
  if (!guardNameInput.value.trim()) return alert('Введите ФИО');
  await startShift(guardNameInput.value);
  isStartModalOpen.value = false;
};

const handleEnd = async () => {
  await endShift(endNotes.value);
  isEndModalOpen.value = false;
  alert('Смена сдана!');
};

const handleBreak = async () => {
  await startBreak(breakCoverName.value || null);
  isBreakModalOpen.value = false;
};
</script>