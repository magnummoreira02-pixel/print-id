<script setup lang="ts">
import { computed } from 'vue'
import { X } from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useEditorContext } from './context'

const props = withDefaults(
  defineProps<{
    /** Colunas explícitas (ordem preservada) */
    columns: string[]
    /** Nomes exibidos quando não há colunas explícitas (autos do campo) */
    autos?: string[]
    /** Explicação mostrada quando `columns` está vazio */
    autoHint?: string
  }>(),
  { autos: () => [], autoHint: 'Automático por safra.' }
)

const emit = defineEmits<{ (e: 'update:columns', value: string[]): void }>()

const ctx = useEditorContext()

const hasMatrix = computed(() => ctx.matrixHeaders.value.length > 0)
const available = computed(() => ctx.matrixHeaders.value.filter((h) => !props.columns.includes(h)))

function add(value: unknown): void {
  if (typeof value !== 'string' || value === '') return
  if (props.columns.includes(value)) return
  emit('update:columns', [...props.columns, value])
}

function removeAt(index: number): void {
  const next = props.columns.slice()
  next.splice(index, 1)
  emit('update:columns', next)
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div v-if="props.columns.length > 0" class="flex flex-wrap gap-1">
      <Badge
        v-for="(col, index) in props.columns"
        :key="col"
        variant="secondary"
        class="max-w-full gap-1 rounded-sm px-1.5 font-mono text-[10px]"
      >
        <span class="truncate">{{ col }}</span>
        <button
          type="button"
          class="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
          :title="`Remover ${col}`"
          @click="removeAt(index)"
        >
          <X class="size-3" />
        </button>
      </Badge>
    </div>

    <template v-else>
      <div v-if="props.autos.length > 0" class="flex flex-wrap gap-1">
        <Badge
          v-for="name in props.autos"
          :key="name"
          variant="outline"
          class="rounded-sm px-1.5 text-[10px] text-muted-foreground"
        >
          {{ name }}
        </Badge>
      </div>
      <p class="text-[10px] text-muted-foreground">{{ props.autoHint }}</p>
    </template>

    <!-- :key remonta o Select após cada escolha para limpar o valor exibido -->
    <Select
      :key="props.columns.length"
      :model-value="undefined"
      :disabled="available.length === 0"
      @update:model-value="add"
    >
      <SelectTrigger class="h-8 w-full font-mono text-[11px]">
        <SelectValue :placeholder="hasMatrix ? 'Adicionar coluna…' : 'Sem matriz importada'" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem v-for="h in available" :key="h" :value="h" class="font-mono text-xs">
          {{ h }}
        </SelectItem>
      </SelectContent>
    </Select>
  </div>
</template>
