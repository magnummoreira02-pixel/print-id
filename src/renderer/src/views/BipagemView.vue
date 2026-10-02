<script setup lang="ts">
import { computed, nextTick, onActivated, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import {
  CircleCheck,
  CircleX,
  Printer,
  RefreshCw,
  ScanBarcode,
  ScanLine,
  Settings2,
  Table2,
  TriangleAlert
} from '@lucide/vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { useMatrix } from '@/composables/useMatrix'
import { useSettings } from '@/composables/useSettings'
import type { CellValue, MatrixRow, PrintResult, ScanResult } from '@shared/types'
import SessionHistory from './bipagem/SessionHistory.vue'
import type { ScanEntry } from './bipagem/types'

interface CurrentScan {
  entryId: number
  code: string
  found: boolean
  rows: MatrixRow[]
}

const router = useRouter()
const { state: matrix } = useMatrix()
const { state: settingsState } = useSettings()

const inputEl = ref<HTMLInputElement | null>(null)
const rawCode = ref('')
const inputFocused = ref(false)
const autoPrint = ref(true)
const looking = ref(false)
const current = ref<CurrentScan | null>(null)
const printStatus = ref<'idle' | 'printing' | 'success' | 'error'>('idle')
const printError = ref('')
const printedCount = ref(0)
const history = ref<ScanEntry[]>([])
let scanSeq = 0

const matrixLoading = computed(() => matrix.loading && !matrix.loaded)
const matrixReady = computed(() => (matrix.payload?.meta.rowCount ?? 0) > 0)
const headers = computed(() => matrix.payload?.meta.headers ?? [])
const printerName = computed(() => settingsState.settings?.printerName ?? null)
const scanColumn = computed(() => settingsState.settings?.scanColumn ?? headers.value[0] ?? null)

const successMessage = computed(() => {
  const target = printerName.value ?? 'a impressora padrão'
  return printedCount.value === 1
    ? `1 etiqueta enviada para ${target}`
    : `${printedCount.value} etiquetas enviadas para ${target}`
})

// ── Foco permanente no campo de bipagem ──────────────────────────────────────

function focusInput(): void {
  inputEl.value?.focus()
}

function onInputBlur(): void {
  inputFocused.value = false
  window.setTimeout(() => {
    if (document.hasFocus()) inputEl.value?.focus()
  }, 80)
}

function onWindowFocus(): void {
  focusInput()
}

onMounted(() => {
  window.addEventListener('focus', onWindowFocus)
  focusInput()
})

// Com KeepAlive, voltar para esta tela reativa (não remonta) o componente
onActivated(() => {
  void nextTick(() => focusInput())
})

onBeforeUnmount(() => {
  window.removeEventListener('focus', onWindowFocus)
})

watch(matrixReady, async (ready) => {
  if (ready) {
    await nextTick()
    focusInput()
  }
})

// ── Fluxo de bipagem ─────────────────────────────────────────────────────────

function onEnter(): void {
  const code = rawCode.value.trim()
  rawCode.value = ''
  if (code === '') return
  void handleScan(code)
}

async function handleScan(code: string): Promise<void> {
  const seq = ++scanSeq
  looking.value = true
  current.value = null
  printStatus.value = 'idle'
  printError.value = ''
  printedCount.value = 0

  let result: ScanResult
  try {
    result = await window.api.lookup(code)
  } catch {
    if (seq === scanSeq) looking.value = false
    toast.error(`Falha ao consultar o código ${code}. Tente novamente.`)
    return
  }

  const entry: ScanEntry = {
    id: seq,
    time: new Date().toLocaleTimeString('pt-BR', { hour12: false }),
    code: result.code,
    found: result.found,
    labels: 0
  }
  history.value.unshift(entry)
  if (history.value.length > 300) history.value.length = 300

  const scan: CurrentScan = {
    entryId: seq,
    code: result.code,
    found: result.found,
    rows: result.rows
  }

  // Um bip mais recente já assumiu a tela: não altera a UI, mas as etiquetas
  // deste bip ainda precisam sair — imprime em segundo plano.
  if (seq !== scanSeq) {
    if (result.found && autoPrint.value) void printScan(scan)
    return
  }

  looking.value = false
  current.value = scan

  if (result.found && autoPrint.value) void printScan(scan)
}

function printCurrent(): void {
  if (current.value) void printScan(current.value)
}

async function printScan(scan: CurrentScan): Promise<void> {
  if (!scan.found || scan.rows.length === 0) return

  if (current.value?.entryId === scan.entryId) {
    printStatus.value = 'printing'
    printError.value = ''
  }

  let result: PrintResult | null = null
  let failureMessage = ''
  try {
    result = await window.api.printLabels(scan.rows.map((r) => r.id))
  } catch {
    failureMessage = 'Falha de comunicação com o serviço de impressão.'
    toast.error(failureMessage)
  }

  const entry = history.value.find((e) => e.id === scan.entryId)
  const isCurrent = current.value?.entryId === scan.entryId

  if (result?.ok) {
    if (entry) {
      entry.labels = result.printed
      entry.error = undefined
    }
    if (isCurrent) {
      printStatus.value = 'success'
      printedCount.value = result.printed
    }
    return
  }

  const message = failureMessage || result?.error || 'Erro desconhecido na impressão.'
  if (entry) entry.error = message
  if (isCurrent) {
    printStatus.value = 'error'
    printError.value = message
  } else if (!failureMessage) {
    toast.error(`Impressão do código ${scan.code} falhou: ${message}`)
  }
}

function clearHistory(): void {
  history.value = []
}

// ── Auxiliares de exibição ───────────────────────────────────────────────────

function cellText(value: CellValue): string {
  return value === null || value === '' ? '—' : String(value)
}

function isNumeric(value: CellValue): boolean {
  return typeof value === 'number'
}
</script>

<template>
  <div class="flex h-full" @click="focusInput">
    <!-- Coluna principal -->
    <div class="flex min-w-0 flex-1 flex-col">
      <!-- Cabeçalho -->
      <header
        class="flex shrink-0 items-center justify-between gap-6 border-b border-border px-6 py-3"
      >
        <div>
          <p class="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Terminal de operação
          </p>
          <h2 class="font-display text-2xl font-bold uppercase tracking-widest text-foreground">
            Bipagem
          </h2>
        </div>
        <div class="flex items-center gap-5">
          <div v-if="scanColumn" class="text-right">
            <p class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Coluna de bipagem
            </p>
            <p class="font-mono text-sm font-semibold text-foreground">{{ scanColumn }}</p>
          </div>
          <div class="h-8 w-px shrink-0 bg-border" />
          <div class="flex items-center gap-2.5">
            <Switch id="auto-print" v-model="autoPrint" />
            <Label
              for="auto-print"
              class="cursor-pointer text-xs font-semibold uppercase tracking-wider"
              :class="autoPrint ? 'text-primary' : 'text-muted-foreground'"
            >
              Impressão automática
            </Label>
          </div>
        </div>
      </header>

      <!-- Banner: sem impressora -->
      <Alert
        v-if="!settingsState.loading && !printerName"
        class="shrink-0 rounded-none border-x-0 border-t-0 border-warning/40 bg-warning/10 text-warning"
      >
        <TriangleAlert class="size-4" />
        <AlertTitle class="text-xs font-semibold uppercase tracking-wider">
          Nenhuma impressora configurada
        </AlertTitle>
        <AlertDescription
          class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs !text-warning/80"
        >
          <span>As etiquetas não serão impressas até que uma impressora seja selecionada.</span>
          <Button
            variant="outline"
            size="xs"
            class="shrink-0 border-warning/40 bg-transparent text-warning hover:bg-warning/15 hover:text-warning"
            @click="router.push('/configuracoes')"
          >
            <Settings2 />
            Abrir Configurações
          </Button>
        </AlertDescription>
      </Alert>

      <!-- Carregando matriz -->
      <div v-if="matrixLoading" class="flex-1 overflow-hidden px-6 py-8">
        <div class="mx-auto max-w-3xl space-y-6">
          <Skeleton class="h-4 w-44" />
          <Skeleton class="h-24 w-full" />
          <Skeleton class="h-56 w-full" />
        </div>
      </div>

      <!-- Sem matriz carregada -->
      <div
        v-else-if="!matrixReady"
        class="flex flex-1 items-center justify-center overflow-auto bg-blueprint p-8"
      >
        <div class="w-full max-w-md border border-border bg-card px-10 py-12 text-center">
          <div
            class="mx-auto flex size-20 items-center justify-center border border-dashed border-border bg-background"
          >
            <ScanBarcode class="size-10 text-muted-foreground" />
          </div>
          <h3
            class="mt-6 font-display text-2xl font-bold uppercase tracking-widest text-foreground"
          >
            Sem matriz
          </h3>
          <p class="mt-2 text-sm text-muted-foreground">
            Importe a matriz na tela de Dados antes de bipar.
          </p>
          <Button class="mt-8 w-full" size="lg" @click="router.push('/dados')">
            <Table2 />
            Ir para Dados
          </Button>
        </div>
      </div>

      <!-- Operação -->
      <div v-else class="flex-1 overflow-y-auto">
        <div class="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-8">
          <!-- Campo de bipagem -->
          <div>
            <div class="mb-2 flex items-center justify-between gap-4">
              <label
                for="scan-input"
                class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
              >
                Código do item
                <template v-if="scanColumn">
                  —
                  <span class="font-mono normal-case tracking-normal text-foreground/80">
                    {{ scanColumn }}
                  </span>
                </template>
              </label>
              <span
                class="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
              >
                <Kbd>Enter</Kbd>
                consulta{{ autoPrint ? ' e imprime' : '' }}
              </span>
            </div>
            <div class="relative">
              <span
                class="pointer-events-none absolute -left-1 -top-1 size-3 border-l-2 border-t-2 transition-colors"
                :class="inputFocused ? 'border-primary' : 'border-muted-foreground/40'"
              />
              <span
                class="pointer-events-none absolute -right-1 -top-1 size-3 border-r-2 border-t-2 transition-colors"
                :class="inputFocused ? 'border-primary' : 'border-muted-foreground/40'"
              />
              <span
                class="pointer-events-none absolute -bottom-1 -left-1 size-3 border-b-2 border-l-2 transition-colors"
                :class="inputFocused ? 'border-primary' : 'border-muted-foreground/40'"
              />
              <span
                class="pointer-events-none absolute -bottom-1 -right-1 size-3 border-b-2 border-r-2 transition-colors"
                :class="inputFocused ? 'border-primary' : 'border-muted-foreground/40'"
              />
              <input
                id="scan-input"
                ref="inputEl"
                v-model="rawCode"
                type="text"
                autocomplete="off"
                spellcheck="false"
                placeholder="Aguardando bip..."
                class="h-24 w-full rounded-none border-2 bg-card px-6 text-center font-mono text-4xl font-medium tracking-[0.12em] text-foreground caret-primary outline-none transition-colors selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground/40"
                :class="inputFocused ? 'border-primary' : 'border-border'"
                @focus="inputFocused = true"
                @blur="onInputBlur"
                @keydown.enter.prevent="onEnter"
              />
              <span
                v-if="inputFocused"
                class="pointer-events-none absolute right-5 top-1/2 size-2.5 -translate-y-1/2 animate-pulse rounded-full bg-primary"
              />
            </div>
          </div>

          <!-- Consultando -->
          <div
            v-if="looking"
            class="flex items-center justify-center gap-3 border border-border bg-card px-6 py-12"
          >
            <Spinner class="size-6 text-primary" />
            <span class="font-display text-xl uppercase tracking-widest text-muted-foreground">
              Consultando...
            </span>
          </div>

          <!-- Não encontrado -->
          <div
            v-else-if="current && !current.found"
            class="border-2 border-destructive bg-destructive/15 px-8 py-10 text-center"
          >
            <CircleX class="mx-auto size-16 text-destructive" />
            <h3
              class="mt-4 font-display text-5xl font-bold uppercase tracking-wide text-destructive"
            >
              ID não encontrado
            </h3>
            <p
              class="mt-6 inline-block border border-destructive/40 bg-background/40 px-8 py-3 font-mono text-5xl font-bold tracking-widest text-foreground"
            >
              {{ current.code }}
            </p>
            <p
              class="mt-6 text-[10px] font-semibold uppercase tracking-[0.3em] text-destructive/90"
            >
              Confira o código e bipe novamente
            </p>
          </div>

          <!-- Encontrado -->
          <div v-else-if="current && current.found" class="border-2 border-primary/70 bg-card">
            <div
              class="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-4"
            >
              <div class="flex items-center gap-4">
                <CircleCheck class="size-10 shrink-0 text-primary" />
                <div>
                  <p class="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary">
                    ID encontrado
                  </p>
                  <p class="font-mono text-5xl font-bold leading-none tracking-wider text-primary">
                    {{ current.code }}
                  </p>
                </div>
              </div>
              <div class="text-right">
                <p
                  class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                >
                  Linhas
                </p>
                <p class="font-display text-5xl font-bold leading-none text-foreground">
                  {{ current.rows.length }}
                </p>
              </div>
            </div>

            <div class="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow class="hover:bg-transparent">
                    <TableHead
                      v-for="header in headers"
                      :key="header"
                      class="h-8 whitespace-nowrap px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {{ header }}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="row in current.rows" :key="row.id">
                    <TableCell
                      v-for="header in headers"
                      :key="header"
                      class="whitespace-nowrap px-3 py-1.5 text-xs"
                      :class="isNumeric(row.data[header]) ? 'font-mono' : ''"
                    >
                      {{ cellText(row.data[header]) }}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <!-- Status da impressão -->
            <div class="border-t border-border px-6 py-4">
              <div v-if="printStatus === 'printing'" class="flex items-center gap-3">
                <Spinner class="size-6 text-primary" />
                <span class="font-display text-lg uppercase tracking-widest text-foreground">
                  Imprimindo...
                </span>
              </div>

              <div
                v-else-if="printStatus === 'success'"
                class="flex items-center gap-3 text-success"
              >
                <CircleCheck class="size-6 shrink-0" />
                <span class="text-lg font-semibold">{{ successMessage }}</span>
              </div>

              <div v-else-if="printStatus === 'error'" class="space-y-3">
                <div
                  class="flex items-start gap-3 border border-destructive bg-destructive/15 px-4 py-3"
                >
                  <CircleX class="mt-0.5 size-5 shrink-0 text-destructive" />
                  <div>
                    <p class="text-xs font-semibold uppercase tracking-wider text-destructive">
                      Falha na impressão
                    </p>
                    <p class="mt-0.5 text-sm text-destructive/90">{{ printError }}</p>
                  </div>
                </div>
                <Button variant="destructive" @click="printCurrent">
                  <RefreshCw />
                  Tentar de novo
                </Button>
              </div>

              <div v-else class="flex flex-wrap items-center justify-between gap-4">
                <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Impressão automática desligada
                </span>
                <Button size="lg" @click="printCurrent">
                  <Printer />
                  Imprimir etiquetas
                </Button>
              </div>
            </div>
          </div>

          <!-- Aguardando leitura -->
          <div
            v-else
            class="flex flex-col items-center justify-center gap-4 border border-dashed border-border bg-blueprint px-6 py-14 text-center"
          >
            <ScanLine class="size-12 text-muted-foreground/60" />
            <div>
              <p
                class="font-display text-xl font-semibold uppercase tracking-[0.25em] text-muted-foreground"
              >
                Aguardando leitura
              </p>
              <p class="mt-2 text-sm text-muted-foreground/80">
                Bipe o código de barras do item para consultar a matriz{{
                  autoPrint ? ' e imprimir as etiquetas automaticamente' : ''
                }}.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Histórico da sessão -->
    <SessionHistory v-if="matrixReady" :entries="history" @clear="clearHistory" />
  </div>
</template>
