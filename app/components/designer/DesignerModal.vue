<!-- app/components/designer/DesignerModal.vue -->
<!-- Обертка для вызова редактора из модалки БД. 
    Teleport to="body" гарантированно скрывает боковую панель и лейаут Nuxt. -->

<template lang="pug">
Teleport(to="body")
  div(
    v-if="isOpen"
    class="fixed inset-0 z-[9999] bg-gray-900 text-white overflow-hidden"
  )
    PersonDesigner(
      :initial-person="person"
      @close="$emit('close')"
      @save="handleSave"
    )
</template>

<script setup lang="ts">
import PersonDesigner from '~/components/simulator/PersonDesigner.vue'

defineProps({
  isOpen: Boolean,
  person: Object
})

const emit = defineEmits(['close', 'save'])

const handleSave = (updatedData: any) => {
  emit('save', updatedData)
}
</script>