<!-- app/components/ui/PageHeader.vue -->
<!-- Назначение: единая шапка страницы — заголовок, однострочное описание,
    слот для действий. Инструмент онбординга: назначение экрана понятно
    с первого взгляда.
    [v2] убран жёсткий mb-4 (интервал задаёт родительский gap),
    добавлен flex-none (шапка не сжимается в min-h-0 контейнерах). -->
<template lang="pug">
.page-header.flex.flex-col.flex-none.gap-1(
  class="sm:flex-row sm:justify-between sm:items-center"
)
  .min-w-0
    //- Заголовок: крупный, с лёгкой отрицательной межбуквенностью
    h1.text-xl.font-bold.tracking-tight.text-base-content(
      class="sm:text-2xl"
    )
      | {{ title }}
    //- Описание: что происходит на этой странице, одним предложением
    p.mt-1.text-sm(
      class="text-base-content/60"
      v-if="description"
    )
      | {{ description }}
    //- Дополнительный контекст (например, активная смена)
    .mt-1(v-if="$slots.meta")
      slot(name="meta")

  //- Действия страницы (кнопки)
  .flex.flex-none.items-center.gap-2.mt-2(
    v-if="$slots.actions"
    class="sm:mt-0"
  )
    slot(name="actions")
</template>

<script setup lang="ts">
// PageHeader — презентационный компонент, логики нет
defineProps<{
  /** Заголовок страницы */
  title: string
  /** Однострочное описание назначения страницы */
  description?: string
}>()
</script>