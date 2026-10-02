<script setup lang="ts">
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Label } from '@/components/ui/label'
import {
  NumberField,
  NumberFieldContent,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput
} from '@/components/ui/number-field'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useSettings } from '@/composables/useSettings'
import { useTemplates } from '@/composables/useTemplates'
import ConfigCard from './ConfigCard.vue'

type Key = 'widthMm' | 'heightMm' | 'copies'

const { state: settingsState, save } = useSettings()
const templates = useTemplates()

const width = ref(50)
const height = ref(25)
const copies = ref(1)
/** Força o remount dos campos ao reverter um valor inválido. */
const formKey = ref(0)

function syncFromState(): void {
  const active = templates.active.value
  if (active) {
    width.value = active.widthMm
    height.value = active.heightMm
  }
  if (settingsState.settings) copies.value = settingsState.settings.copies
}

watch([() => templates.active.value, () => settingsState.settings?.copies], syncFromState, {
  immediate: true,
  deep: true
})

const timers: Partial<Record<Key, ReturnType<typeof setTimeout>>> = {}

function commit(key: Key, value: number | undefined): void {
  // Campo esvaziado emite undefined/NaN dependendo da versão do reka-ui;
  // nunca deixar um não-número chegar às configurações (quebraria o pageSize)
  if (value == null || !Number.isFinite(value)) {
    syncFromState()
    formKey.value++
    return
  }
  if (key === 'widthMm') width.value = value
  if (key === 'heightMm') height.value = value
  if (key === 'copies') copies.value = value
  // captura o template alvo agora: se o ativo mudar durante o debounce,
  // o valor não pode ser aplicado ao template errado
  const targetId = templates.active.value?.id ?? null
  clearTimeout(timers[key])
  timers[key] = setTimeout(() => {
    void persist(key, value, targetId)
  }, 450)
}

async function persist(key: Key, value: number, targetId: string | null): Promise<void> {
  try {
    if (key === 'copies') {
      if (settingsState.settings?.copies === value) return
      await save({ copies: value })
      toast.success('Cópias por linha salvas.')
      return
    }
    const target = targetId ? templates.byId(targetId) : null
    if (!target) {
      syncFromState()
      return
    }
    if (target[key] === value) return
    await templates.upsert({ ...JSON.parse(JSON.stringify(target)), [key]: value })
    toast.success(key === 'widthMm' ? 'Largura da etiqueta salva.' : 'Altura da etiqueta salva.')
  } catch {
    toast.error('Não foi possível salvar as configurações da etiqueta.')
    syncFromState()
    formKey.value++
  }
}
</script>

<template>
  <ConfigCard title="Etiqueta">
    <Skeleton v-if="!settingsState.settings" class="h-28 w-full" />

    <div v-else :key="formKey" class="flex flex-col gap-4">
      <p v-if="templates.active.value" class="text-[10px] text-muted-foreground">
        Tamanho do modelo ativo:
        <span class="font-mono text-foreground/80">{{ templates.active.value.name }}</span>
      </p>
      <div class="grid grid-cols-2 gap-3">
        <NumberField
          id="label-width"
          :model-value="width"
          :min="10"
          :max="300"
          :step="1"
          :format-options="{ maximumFractionDigits: 0 }"
          @update:model-value="(v) => commit('widthMm', v)"
        >
          <Label
            for="label-width"
            class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
          >
            Largura (mm)
          </Label>
          <NumberFieldContent>
            <NumberFieldDecrement />
            <NumberFieldInput class="font-mono" />
            <NumberFieldIncrement />
          </NumberFieldContent>
        </NumberField>

        <NumberField
          id="label-height"
          :model-value="height"
          :min="5"
          :max="300"
          :step="1"
          :format-options="{ maximumFractionDigits: 0 }"
          @update:model-value="(v) => commit('heightMm', v)"
        >
          <Label
            for="label-height"
            class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
          >
            Altura (mm)
          </Label>
          <NumberFieldContent>
            <NumberFieldDecrement />
            <NumberFieldInput class="font-mono" />
            <NumberFieldIncrement />
          </NumberFieldContent>
        </NumberField>
      </div>

      <p class="text-xs text-muted-foreground">
        Tamanho físico da etiqueta no rolo. Padrão 50 × 25 mm.
      </p>

      <Separator />

      <div class="grid grid-cols-2 items-end gap-3">
        <NumberField
          id="label-copies"
          :model-value="copies"
          :min="1"
          :max="10"
          :step="1"
          :format-options="{ maximumFractionDigits: 0 }"
          @update:model-value="(v) => commit('copies', v)"
        >
          <Label
            for="label-copies"
            class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
          >
            Cópias por linha
          </Label>
          <NumberFieldContent>
            <NumberFieldDecrement />
            <NumberFieldInput class="font-mono" />
            <NumberFieldIncrement />
          </NumberFieldContent>
        </NumberField>

        <p class="pb-1 text-xs text-muted-foreground">
          Etiquetas impressas para cada linha selecionada.
        </p>
      </div>
    </div>
  </ConfigCard>
</template>
