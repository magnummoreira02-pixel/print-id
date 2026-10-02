<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue'
import { toast } from 'vue-sonner'
import { TableCell } from '@/components/ui/table'
import { useMatrix } from '@/composables/useMatrix'
import type { CellValue } from '@shared/types'

const props = defineProps<{
  rowId: number
  column: string
  value: CellValue
  numeric: boolean
}>()

const { updateCell } = useMatrix()

const editing = ref(false)
const saving = ref(false)
const flashing = ref(false)
const draft = ref('')
const inputEl = ref<HTMLInputElement | null>(null)

let canceled = false
let flashTimer: number | undefined

function startEdit(): void {
  // dblclick dentro do input (seleção de palavra) borbulha até a célula —
  // não reiniciar a edição descartando o que foi digitado
  if (editing.value || saving.value) return
  canceled = false
  draft.value = props.value === null ? '' : String(props.value)
  editing.value = true
  void nextTick(() => {
    inputEl.value?.focus()
    inputEl.value?.select()
  })
}

/** Interpreta números no formato pt-BR: "1.234" → 1234, "1.234,56" → 1234.56 */
function parseBrNumber(s: string): number {
  if (s.includes(',')) {
    if (s.indexOf(',') !== s.lastIndexOf(',')) return NaN
    return Number(s.replace(/\./g, '').replace(',', '.'))
  }
  // apenas pontos: padrão de milhar (1.234.567) é reinterpretado sem os pontos
  if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ''))
  return Number(s)
}

function parseDraft(): CellValue {
  const trimmed = draft.value.trim()
  if (trimmed === '') return null
  if (typeof props.value === 'number' || (props.value === null && props.numeric)) {
    const parsed = parseBrNumber(trimmed)
    if (Number.isFinite(parsed)) return parsed
  }
  return trimmed
}

async function commit(): Promise<void> {
  if (!editing.value || canceled) return
  editing.value = false
  const next = parseDraft()
  if (next === props.value) return
  saving.value = true
  try {
    await updateCell(props.rowId, props.column, next)
    flashing.value = true
    window.clearTimeout(flashTimer)
    flashTimer = window.setTimeout(() => {
      flashing.value = false
    }, 500)
  } catch {
    toast.error(`Falha ao salvar a coluna "${props.column}". O valor não foi alterado.`)
  } finally {
    saving.value = false
  }
}

function cancel(): void {
  canceled = true
  editing.value = false
}

onBeforeUnmount(() => {
  window.clearTimeout(flashTimer)
})
</script>

<template>
  <TableCell
    :class="[
      'px-2 py-1.5 text-xs transition-colors duration-500',
      numeric ? 'text-right font-mono' : 'text-left',
      flashing ? 'bg-primary/20 duration-0' : ''
    ]"
    @dblclick="startEdit"
  >
    <input
      v-if="editing"
      ref="inputEl"
      v-model="draft"
      spellcheck="false"
      class="h-6 w-full min-w-20 rounded-sm border border-primary/70 bg-background px-1.5 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/50"
      :class="numeric ? 'text-right' : 'text-left'"
      @blur="commit"
      @keydown.enter.prevent="commit"
      @keydown.esc.prevent="cancel"
    />
    <template v-else>
      <span v-if="value === null || value === ''" class="text-muted-foreground/40">&mdash;</span>
      <template v-else>{{ value }}</template>
    </template>
  </TableCell>
</template>
