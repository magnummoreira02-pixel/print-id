<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  FileSpreadsheet,
  FileText,
  Search,
  TriangleAlert,
  Upload
} from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useMatrix } from '@/composables/useMatrix'
import type { CellValue, MatrixRow } from '@shared/types'
import EditableCell from './dados/EditableCell.vue'

const PAGE_SIZE = 100

const { state, importFile, exportFile } = useMatrix()

const searchInput = ref('')
const searchTerm = ref('')
const sortState = ref<{ column: string; dir: 'asc' | 'desc' } | null>(null)
const page = ref(1)
const confirmOpen = ref(false)
const importing = ref(false)
const exporting = ref(false)
const tableScroll = ref<HTMLElement | null>(null)

const nf = new Intl.NumberFormat('pt-BR')

const payload = computed(() => state.payload)
const headers = computed<string[]>(() => state.payload?.meta.headers ?? [])
const totalRows = computed(() => state.payload?.rows.length ?? 0)

const importedAtLabel = computed(() => {
  const iso = state.payload?.meta.importedAt
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
})

/** Coluna é numérica quando toda célula preenchida é number. */
const numericColumns = computed<Record<string, boolean>>(() => {
  const current = state.payload
  const map: Record<string, boolean> = {}
  if (!current) return map
  for (const header of current.meta.headers) {
    let hasValue = false
    let allNumeric = true
    for (const row of current.rows) {
      const value = row.data[header]
      if (value === null || value === undefined || value === '') continue
      hasValue = true
      if (typeof value !== 'number') {
        allNumeric = false
        break
      }
    }
    map[header] = hasValue && allNumeric
  }
  return map
})

// Busca com debounce ~200ms
let searchTimer: number | undefined
watch(searchInput, (value) => {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => {
    searchTerm.value = value.trim().toLowerCase()
    page.value = 1
  }, 200)
})

const filteredRows = computed<MatrixRow[]>(() => {
  const current = state.payload
  if (!current) return []
  const term = searchTerm.value
  if (!term) return current.rows
  return current.rows.filter((row) =>
    current.meta.headers.some((header) => {
      const value = row.data[header]
      return value !== null && value !== undefined && String(value).toLowerCase().includes(term)
    })
  )
})

// Collator reutilizado: localeCompare por comparação é ordens de grandeza
// mais lento ao ordenar 7k linhas
const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' })

function compareCells(a: CellValue, b: CellValue, numeric: boolean): number {
  if (numeric) {
    const na = typeof a === 'number' ? a : Number(a)
    const nb = typeof b === 'number' ? b : Number(b)
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb
  }
  return collator.compare(String(a), String(b))
}

const sortedRows = computed<MatrixRow[]>(() => {
  const sort = sortState.value
  if (!sort) return filteredRows.value
  const numeric = numericColumns.value[sort.column] === true
  const dir = sort.dir === 'asc' ? 1 : -1
  return [...filteredRows.value].sort((a, b) => {
    const va = a.data[sort.column] ?? null
    const vb = b.data[sort.column] ?? null
    if (va === null && vb === null) return 0
    if (va === null) return 1
    if (vb === null) return -1
    return dir * compareCells(va, vb, numeric)
  })
})

const totalPages = computed(() => Math.max(1, Math.ceil(sortedRows.value.length / PAGE_SIZE)))

watch(totalPages, (total) => {
  if (page.value > total) page.value = total
})

watch(page, () => {
  if (tableScroll.value) tableScroll.value.scrollTop = 0
})

const pagedRows = computed<MatrixRow[]>(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return sortedRows.value.slice(start, start + PAGE_SIZE)
})

const rangeLabel = computed(() => {
  const total = sortedRows.value.length
  if (total === 0) return '0 de 0'
  const start = (page.value - 1) * PAGE_SIZE + 1
  const end = Math.min(page.value * PAGE_SIZE, total)
  return `${nf.format(start)}–${nf.format(end)} de ${nf.format(total)}`
})

function toggleSort(column: string): void {
  const sort = sortState.value
  if (!sort || sort.column !== column) {
    sortState.value = { column, dir: 'asc' }
  } else if (sort.dir === 'asc') {
    sortState.value = { column, dir: 'desc' }
  } else {
    sortState.value = null
  }
}

function sortIcon(column: string): typeof ArrowUpDown {
  const sort = sortState.value
  if (!sort || sort.column !== column) return ArrowUpDown
  return sort.dir === 'asc' ? ArrowUp : ArrowDown
}

function onImportClick(): void {
  if (state.payload) {
    confirmOpen.value = true
  } else {
    void doImport()
  }
}

async function doImport(): Promise<void> {
  confirmOpen.value = false
  importing.value = true
  try {
    const result = await importFile()
    if (result.canceled) return
    if (!result.ok) {
      toast.error(result.error ?? 'Falha ao importar o arquivo.')
      return
    }
    searchInput.value = ''
    searchTerm.value = ''
    sortState.value = null
    page.value = 1
    const count = result.payload?.meta.rowCount ?? 0
    toast.success(`Matriz importada: ${nf.format(count)} linhas.`)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    toast.error(`Erro inesperado ao importar a matriz: ${detail}`)
  } finally {
    importing.value = false
  }
}

async function doExport(format: 'xlsx' | 'csv'): Promise<void> {
  exporting.value = true
  try {
    const result = await exportFile(format)
    if (result.canceled) return
    if (!result.ok) {
      toast.error(result.error ?? 'Falha ao exportar a matriz.')
      return
    }
    toast.success('Matriz exportada com sucesso.', { description: result.filePath })
  } catch {
    toast.error('Erro inesperado ao exportar a matriz.')
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Cabeçalho -->
    <header class="shrink-0 border-b border-border bg-card/40 px-6 py-4">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Matriz de ensaios
          </p>
          <h2 class="font-display text-3xl font-bold uppercase tracking-widest">Dados</h2>
        </div>
        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            :disabled="importing || state.loading"
            @click="onImportClick"
          >
            <Upload />
            Importar
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="outline" size="sm" :disabled="!payload || exporting">
                <Download />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem @click="doExport('xlsx')">
                <FileSpreadsheet class="size-4" />
                Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem @click="doExport('csv')">
                <FileText class="size-4" />
                CSV (.csv)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div
        v-if="payload"
        class="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground"
      >
        <div class="flex items-center gap-2">
          <span class="text-[10px] font-semibold uppercase tracking-[0.2em]">Arquivo</span>
          <span class="font-mono text-foreground">{{ payload.meta.fileName }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[10px] font-semibold uppercase tracking-[0.2em]">Linhas</span>
          <span class="font-mono text-foreground">{{ nf.format(payload.meta.rowCount) }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[10px] font-semibold uppercase tracking-[0.2em]">Importado em</span>
          <span class="font-mono text-foreground">{{ importedAtLabel }}</span>
        </div>
      </div>
    </header>

    <!-- Carregando -->
    <div v-if="state.loading && !payload" class="min-h-0 flex-1 overflow-hidden p-6">
      <div class="space-y-2">
        <div class="flex gap-2">
          <Skeleton v-for="i in 6" :key="`h-${i}`" class="h-8 flex-1" />
        </div>
        <Skeleton v-for="i in 14" :key="`r-${i}`" class="h-7 w-full" />
      </div>
    </div>

    <!-- Estado vazio -->
    <div
      v-else-if="!payload"
      class="bg-blueprint flex min-h-0 flex-1 flex-col items-center justify-center gap-5 p-8"
    >
      <div class="flex size-20 items-center justify-center rounded-md border border-border bg-card">
        <FileSpreadsheet class="size-10 text-muted-foreground" />
      </div>
      <div class="text-center">
        <h3 class="font-display text-xl font-bold uppercase tracking-widest">
          Nenhuma matriz carregada
        </h3>
        <p class="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Importe um arquivo Excel ou CSV com a matriz de ensaios para consultar, editar e imprimir
          etiquetas a partir da bipagem.
        </p>
      </div>
      <Button :disabled="importing" @click="onImportClick">
        <Upload />
        Importar matriz
      </Button>
    </div>

    <!-- Tabela -->
    <div v-else class="flex min-h-0 flex-1 flex-col">
      <div class="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2">
        <div class="relative w-full max-w-sm">
          <Search
            class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            v-model="searchInput"
            placeholder="Buscar em todas as colunas..."
            class="h-8 pl-8 text-sm"
          />
        </div>
        <div v-if="searchTerm" class="shrink-0 text-xs text-muted-foreground">
          <span class="font-mono text-foreground">{{ nf.format(filteredRows.length) }}</span>
          de
          <span class="font-mono">{{ nf.format(totalRows) }}</span>
          linhas
        </div>
      </div>

      <div ref="tableScroll" class="min-h-0 flex-1 overflow-auto">
        <table class="w-full caption-bottom text-sm">
          <TableHeader class="sticky top-0 z-10 bg-card [&_tr]:border-b-0">
            <TableRow class="hover:bg-transparent">
              <TableHead
                v-for="header in headers"
                :key="header"
                class="h-9 cursor-pointer bg-card px-2 shadow-[inset_0_-1px_0_0_var(--color-border)] hover:bg-accent/40"
                @click="toggleSort(header)"
              >
                <div
                  class="flex items-center gap-1.5"
                  :class="numericColumns[header] ? 'justify-end' : ''"
                >
                  <span
                    class="text-[10px] font-semibold uppercase tracking-[0.2em]"
                    :class="
                      sortState?.column === header ? 'text-foreground' : 'text-muted-foreground'
                    "
                  >
                    {{ header }}
                  </span>
                  <component
                    :is="sortIcon(header)"
                    class="size-3 shrink-0"
                    :class="
                      sortState?.column === header ? 'text-primary' : 'text-muted-foreground/40'
                    "
                  />
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="row in pagedRows"
              :key="row.id"
              class="even:bg-muted/20 hover:bg-accent/30"
            >
              <EditableCell
                v-for="header in headers"
                :key="header"
                :row-id="row.id"
                :column="header"
                :value="row.data[header] ?? null"
                :numeric="numericColumns[header] === true"
              />
            </TableRow>
            <TableRow v-if="pagedRows.length === 0" class="hover:bg-transparent">
              <TableCell
                :colspan="headers.length"
                class="h-24 text-center text-sm text-muted-foreground"
              >
                Nenhuma linha corresponde à busca.
              </TableCell>
            </TableRow>
          </TableBody>
        </table>
      </div>

      <div
        class="flex shrink-0 items-center justify-between gap-4 border-t border-border px-4 py-2"
      >
        <p class="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
          Duplo clique numa célula para editar
        </p>
        <div class="flex items-center gap-3">
          <span class="font-mono text-xs text-muted-foreground">{{ rangeLabel }}</span>
          <div class="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-xs"
              aria-label="Primeira página"
              :disabled="page <= 1"
              @click="page = 1"
            >
              <ChevronsLeft />
            </Button>
            <Button
              variant="outline"
              size="icon-xs"
              aria-label="Página anterior"
              :disabled="page <= 1"
              @click="page--"
            >
              <ChevronLeft />
            </Button>
            <span class="min-w-14 text-center font-mono text-xs">
              {{ nf.format(page) }} / {{ nf.format(totalPages) }}
            </span>
            <Button
              variant="outline"
              size="icon-xs"
              aria-label="Próxima página"
              :disabled="page >= totalPages"
              @click="page++"
            >
              <ChevronRight />
            </Button>
            <Button
              variant="outline"
              size="icon-xs"
              aria-label="Última página"
              :disabled="page >= totalPages"
              @click="page = totalPages"
            >
              <ChevronsRight />
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Confirmação de substituição -->
    <Dialog v-model:open="confirmOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2 font-display uppercase tracking-wider">
            <TriangleAlert class="size-5 text-warning" />
            Substituir matriz atual?
          </DialogTitle>
          <DialogDescription>
            A matriz carregada (<span class="font-mono">{{
              nf.format(payload?.meta.rowCount ?? 0)
            }}</span>
            linhas de
            <span class="font-mono">{{ payload?.meta.fileName }}</span
            >) será <span class="font-semibold text-destructive">substituída</span> pela nova
            importação. Alterações feitas nas células serão perdidas se não tiverem sido exportadas.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="confirmOpen = false">Cancelar</Button>
          <Button variant="destructive" :disabled="importing" @click="doImport()">
            Substituir e importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
