<script setup lang="ts">
import { Label } from '@/components/ui/label'
import {
  NumberField,
  NumberFieldContent,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput
} from '@/components/ui/number-field'

const props = withDefaults(
  defineProps<{
    id: string
    modelValue: number
    min: number
    max: number
    label?: string
    step?: number
    digits?: number
    disabled?: boolean
  }>(),
  { label: undefined, step: 0.1, digits: 2, disabled: false }
)

const emit = defineEmits<{ (e: 'update:modelValue', value: number): void }>()

function onUpdate(value: number | undefined): void {
  // Campo esvaziado pode emitir undefined/NaN — nunca propagar não-número
  if (value == null || !Number.isFinite(value)) return
  emit('update:modelValue', value)
}
</script>

<template>
  <NumberField
    :id="props.id"
    :model-value="props.modelValue"
    :min="props.min"
    :max="props.max"
    :step="props.step"
    :disabled="props.disabled"
    locale="pt-BR"
    :format-options="{ maximumFractionDigits: props.digits }"
    class="gap-1"
    @update:model-value="onUpdate"
  >
    <Label
      v-if="props.label"
      :for="props.id"
      class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
    >
      {{ props.label }}
    </Label>
    <NumberFieldContent>
      <NumberFieldDecrement />
      <NumberFieldInput class="h-8 font-mono text-xs" />
      <NumberFieldIncrement />
    </NumberFieldContent>
  </NumberField>
</template>
