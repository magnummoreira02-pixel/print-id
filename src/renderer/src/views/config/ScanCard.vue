<script setup lang="ts">
import { computed } from 'vue'
import { toast } from 'vue-sonner'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useMatrix } from '@/composables/useMatrix'
import { useSettings } from '@/composables/useSettings'
import ConfigCard from './ConfigCard.vue'

const { state: matrixState } = useMatrix()
const { state: settingsState, save } = useSettings()

const headers = computed(() => matrixState.payload?.meta.headers ?? [])
const hasMatrix = computed(() => headers.value.length > 0)
const scanColumn = computed(() => settingsState.settings?.scanColumn ?? undefined)

async function onSelectColumn(value: unknown): Promise<void> {
  if (typeof value !== 'string' || value.length === 0) return
  if (value === settingsState.settings?.scanColumn) return
  try {
    await save({ scanColumn: value })
    toast.success(`Coluna de bipagem alterada para "${value}". O índice de busca foi reconstruído.`)
  } catch {
    toast.error('Não foi possível alterar a coluna de bipagem.')
  }
}
</script>

<template>
  <ConfigCard title="Bipagem">
    <div class="flex flex-col gap-1.5">
      <Label class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Coluna-chave do bip
      </Label>

      <Select :model-value="scanColumn" :disabled="!hasMatrix" @update:model-value="onSelectColumn">
        <SelectTrigger class="w-full font-mono text-xs">
          <SelectValue placeholder="Selecione a coluna" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="header in headers"
            :key="header"
            :value="header"
            class="font-mono text-xs"
          >
            {{ header }}
          </SelectItem>
        </SelectContent>
      </Select>

      <p v-if="!hasMatrix" class="text-xs text-warning">Importe uma matriz primeiro.</p>
      <p v-else class="text-xs text-muted-foreground">
        Coluna comparada com o código lido pelo leitor. Um mesmo valor pode retornar várias linhas
        (uma por LOCAL).
      </p>
    </div>
  </ConfigCard>
</template>
