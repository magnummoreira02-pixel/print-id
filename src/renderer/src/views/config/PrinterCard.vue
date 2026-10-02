<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Printer, RefreshCw, TriangleAlert } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { useSettings } from '@/composables/useSettings'
import type { PrinterInfo } from '@shared/types'
import ConfigCard from './ConfigCard.vue'

const { state: settingsState, save } = useSettings()

const printers = ref<PrinterInfo[]>([])
const loadingPrinters = ref(false)
const testing = ref(false)

const selectedPrinter = computed(() => settingsState.settings?.printerName ?? undefined)
const defaultPrinter = computed(() => printers.value.find((p) => p.isDefault))
/** Impressora salva que não existe mais no Windows (desligada/removida). */
const selectedMissing = computed(
  () =>
    !loadingPrinters.value &&
    printers.value.length > 0 &&
    !!selectedPrinter.value &&
    !printers.value.some((p) => p.name === selectedPrinter.value)
)

async function loadPrinters(): Promise<void> {
  loadingPrinters.value = true
  try {
    printers.value = await window.api.listPrinters()
  } catch {
    toast.error('Não foi possível listar as impressoras instaladas.')
  } finally {
    loadingPrinters.value = false
  }
}

async function onSelectPrinter(value: unknown): Promise<void> {
  if (typeof value !== 'string' || value.length === 0) return
  if (value === settingsState.settings?.printerName) return
  try {
    await save({ printerName: value })
    const info = printers.value.find((p) => p.name === value)
    toast.success(`Impressora "${info?.displayName ?? value}" definida como destino.`)
  } catch {
    toast.error('Não foi possível salvar a impressora selecionada.')
  }
}

async function runPrintTest(): Promise<void> {
  if (testing.value) return
  testing.value = true
  try {
    const result = await window.api.printTest()
    if (result.ok) {
      toast.success('Etiqueta de teste enviada à impressora.')
    } else {
      toast.error(`Falha no teste de impressão: ${result.error ?? 'erro desconhecido'}.`)
    }
  } catch {
    toast.error('Falha no teste de impressão: não foi possível comunicar com a impressora.')
  } finally {
    testing.value = false
  }
}

onMounted(loadPrinters)
</script>

<template>
  <ConfigCard title="Impressora">
    <template #action>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Recarregar lista de impressoras"
        :disabled="loadingPrinters"
        @click="loadPrinters"
      >
        <RefreshCw :class="loadingPrinters ? 'animate-spin' : ''" />
      </Button>
    </template>

    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-1.5">
        <Label class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Impressora de etiquetas
        </Label>

        <Skeleton v-if="loadingPrinters && printers.length === 0" class="h-9 w-full" />

        <Alert v-else-if="printers.length === 0">
          <TriangleAlert class="text-warning" />
          <AlertTitle>Nenhuma impressora encontrada</AlertTitle>
          <AlertDescription>
            O Windows não retornou nenhuma impressora instalada. Conecte a impressora térmica,
            confira o driver e recarregue a lista.
          </AlertDescription>
        </Alert>

        <template v-else>
          <Select :model-value="selectedPrinter" @update:model-value="onSelectPrinter">
            <SelectTrigger class="w-full">
              <SelectValue placeholder="Selecione a impressora" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="p in printers" :key="p.name" :value="p.name">
                {{ p.displayName || p.name }}
              </SelectItem>
            </SelectContent>
          </Select>
          <p v-if="selectedMissing" class="text-xs font-medium text-warning">
            A impressora salva ("{{ selectedPrinter }}") não foi encontrada no Windows. As
            impressões vão falhar até selecionar outra.
          </p>
          <p class="text-xs text-muted-foreground">
            <template v-if="defaultPrinter">
              Padrão do Windows:
              <span class="font-mono text-foreground/80">{{
                defaultPrinter.displayName || defaultPrinter.name
              }}</span>
            </template>
            <template v-else>Destino de todas as impressões de etiquetas.</template>
          </p>
        </template>
      </div>

      <Separator />

      <div class="flex flex-col gap-1.5">
        <Button
          variant="secondary"
          class="w-full"
          :disabled="!selectedPrinter || testing"
          @click="runPrintTest"
        >
          <Spinner v-if="testing" />
          <Printer v-else />
          {{ testing ? 'Imprimindo teste…' : 'Imprimir etiqueta de teste' }}
        </Button>
        <p v-if="!selectedPrinter" class="text-xs text-muted-foreground">
          Selecione uma impressora para habilitar o teste.
        </p>
      </div>
    </div>
  </ConfigCard>
</template>
