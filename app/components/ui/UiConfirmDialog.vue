<!-- app/components/ui/UiConfirmDialog.vue -->
<!-- Назначение: глобальный диалог подтверждения (монтируется в app.vue).
    Работает в паре с useConfirm(): тот кладёт вопрос в useState, этот
    рисует DaisyUI-модалку и завершает промис через settle().
    [A11y] Enter = подтверждение, Esc = отмена; фокус на кнопке отмены
    (опасные действия — привычнее подтверждать осознанно). -->
<template lang="pug">
.dialog.modal(
  :class="state.isOpen ? 'modal-open' : ''"
  @keydown.esc.prevent="cancel"
)
  .modal-box.max-w-md
    .flex.items-start.gap-3
      //- Иконка опасности — только для danger-режима
      .shrink-0.w-12.h-12.rounded-full.flex.items-center.justify-center(
        v-if="state.danger"
        class="bg-error/10 text-error"
      )
        svg.w-6.h-6(fill="none" stroke="currentColor" viewBox="0 0 24 24")
          path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z")

      .min-w-0
        h3.text-lg.font-bold.leading-tight {{ state.title }}
        p.mt-2.text-sm.break-words(
          class="text-base-content/70"
          v-if="state.message"
        ) {{ state.message }}

    .modal-action.mt-5
      button.btn.btn-ghost(
        ref="cancelBtnRef"
        type="button"
        @click="cancel"
      ) {{ state.cancelLabel }}
      button.btn(
        :class="state.danger ? 'btn-error' : 'btn-primary'"
        type="button"
        @click="confirmAction"
      ) {{ state.confirmLabel }}

  //- Клик по фону = отмена
  form.modal-backdrop(@click="cancel")
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useConfirm } from '~/composables/useConfirm'

const { state, settle } = useConfirm()

const cancelBtnRef = ref<HTMLButtonElement | null>(null)

const confirmAction = () => settle(true)
const cancel = () => settle(false)

// При открытии — фокус на «Отмена» (безопасный дефолт)
watch(() => state.value.isOpen, async (open) => {
  if (open) {
    await nextTick()
    cancelBtnRef.value?.focus()
  }
})

// Глобальный Esc (модалка не в фокусе, если клик был мимо input'ов)
const onGlobalKey = (e: KeyboardEvent) => {
  if (state.value.isOpen && e.key === 'Escape') cancel()
}
onMounted(() => window.addEventListener('keydown', onGlobalKey))
onUnmounted(() => window.removeEventListener('keydown', onGlobalKey))
</script>