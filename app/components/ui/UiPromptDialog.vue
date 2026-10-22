<!-- app/components/ui/UiPromptDialog.vue -->
<!-- Назначение: глобальный диалог ввода текста (замена window.prompt).
     Монтируется в app.vue рядом с UiConfirmDialog; работает в паре с usePrompt().
     [A11y] Enter = подтверждение, Esc = отмена; при открытии фокус в поле,
     текст выделен — можно сразу печатать поверх. -->
<template lang="pug">
.dialog.modal(
  ref="dialogRootRef"
  :class="state.isOpen ? 'modal-open' : ''"
)
  .modal-box.max-w-md
    h3.text-lg.font-bold.leading-tight {{ state.title }}
    p.mt-2.text-sm.break-words(
      class="text-base-content/70"
      v-if="state.message"
    ) {{ state.message }}
    input.input.input-bordered.w-full.mt-4(
      ref="inputRef"
      v-model="state.value"
      :placeholder="state.placeholder"
      type="text"
      @keyup.enter="confirmAction"
      @keydown.esc.prevent="cancel"
    )
    .modal-action.mt-5
      button.btn.btn-ghost(type="button" @click="cancel") {{ state.cancelLabel }}
      button.btn.btn-primary(type="button" @click="confirmAction") {{ state.confirmLabel }}

  //- Клик по фону = отмена
  form.modal-backdrop(@click="cancel")
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { usePrompt } from '~/composables/usePrompt'

const { state, settle } = usePrompt()

const inputRef = ref<HTMLInputElement | null>(null)

const confirmAction = () => settle(state.value.value)
const cancel = () => settle(null)

// При открытии — фокус в поле ввода, текст выделен
watch(() => state.value.isOpen, async (open) => {
  if (open) {
    await nextTick()
    inputRef.value?.focus()
    inputRef.value?.select()
  }
})

// [№15-A11Y] Esc/ловушка фокуса/возврат фокуса — общий useModalA11y
const dialogRootRef = ref<HTMLElement | null>(null)
import { useModalA11y } from '~/composables/useModalA11y'
useModalA11y({ isOpen: () => state.value.isOpen, onClose: cancel, root: dialogRootRef })
</script>
