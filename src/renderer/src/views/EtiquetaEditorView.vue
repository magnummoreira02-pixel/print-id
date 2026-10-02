<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  Braces,
  ChevronDown,
  Plus,
  QrCode,
  Redo2,
  Save,
  Square,
  Type,
  Undo2
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { useMatrix } from '@/composables/useMatrix'
import { useSettings } from '@/composables/useSettings'
import { useTemplates } from '@/composables/useTemplates'
import { newElementId } from '@shared/labelTemplate'
import type { LabelElement, LabelTemplate, RowData } from '@shared/types'
import { EDITOR_CONTEXT, type EditorContext, type ElementKind } from './etiqueta-editor/context'
import EditorCanvas from './etiqueta-editor/EditorCanvas.vue'
import { createElement, round2 } from './etiqueta-editor/editorUtils'
import ElementsList from './etiqueta-editor/ElementsList.vue'
import { sampleData, sampleHeaders } from './etiqueta-editor/labelRender'
import MmField from './etiqueta-editor/MmField.vue'
import PropertiesPanel from './etiqueta-editor/PropertiesPanel.vue'

// O shell exclui esta tela do KeepAlive pelo nome
defineOptions({ name: 'EtiquetaEditorView' })

const route = useRoute()
const router = useRouter()
const { byId, upsert } = useTemplates()
const { state: settingsState, load: loadSettings } = useSettings()
const { state: matrixState, refresh: refreshMatrix } = useMatrix()

/** Cópia local editável (nunca structuredClone: Proxies reativos lançam DataCloneError) */
const localTemplate = ref<LabelTemplate | null>(null)
const savedJson = ref('')
const selectedId = ref<string | null>(null)
const saving = ref(false)

const dirty = computed(
  () => localTemplate.value !== null && JSON.stringify(localTemplate.value) !== savedJson.value
)

// ——— Histórico de desfazer/refazer (snapshots JSON, agrupados por pausa) ———

const HISTORY_LIMIT = 100
const history = ref<string[]>([])
const historyIndex = ref(-1)
const canUndo = computed(() => historyIndex.value > 0)
const canRedo = computed(() => historyIndex.value < history.value.length - 1)
let applyingHistory = false
let historyTimer: number | undefined

function resetHistory(json: string): void {
  window.clearTimeout(historyTimer)
  history.value = [json]
  historyIndex.value = 0
}

watch(
  localTemplate,
  (t) => {
    if (!t || applyingHistory) return
    window.clearTimeout(historyTimer)
    historyTimer = window.setTimeout(() => {
      const json = JSON.stringify(localTemplate.value)
      if (!localTemplate.value || history.value[historyIndex.value] === json) return
      // nova ação invalida o ramo de refazer
      history.value.splice(historyIndex.value + 1)
      history.value.push(json)
      if (history.value.length > HISTORY_LIMIT) history.value.shift()
      historyIndex.value = history.value.length - 1
    }, 300)
  },
  { deep: true }
)

function applyHistorySnapshot(json: string): void {
  applyingHistory = true
  window.clearTimeout(historyTimer)
  localTemplate.value = JSON.parse(json) as LabelTemplate
  if (selectedId.value && !localTemplate.value.elements.some((e) => e.id === selectedId.value)) {
    selectedId.value = null
  }
  void nextTick(() => {
    applyingHistory = false
  })
}

function undo(): void {
  if (!canUndo.value) return
  historyIndex.value--
  applyHistorySnapshot(history.value[historyIndex.value])
}

function redo(): void {
  if (!canRedo.value) return
  historyIndex.value++
  applyHistorySnapshot(history.value[historyIndex.value])
}

// ——— Dados de exemplo: primeira linha da matriz ou amostra fixa ———

const headers = computed<string[]>(() => {
  const payload = matrixState.payload
  return payload && payload.rows.length > 0 ? payload.meta.headers : sampleHeaders()
})
const rowData = computed<RowData>(() => {
  const payload = matrixState.payload
  return payload && payload.rows.length > 0 ? payload.rows[0].data : sampleData()
})
const matrixHeaders = computed<string[]>(() => matrixState.payload?.meta.headers ?? [])

// ——— Contexto do editor (os filhos só montam quando localTemplate existe) ———

const templateForContext = computed<LabelTemplate>(() => localTemplate.value as LabelTemplate)

const selectedElement = computed<LabelElement | null>(() => {
  const t = localTemplate.value
  if (!t || !selectedId.value) return null
  return t.elements.find((e) => e.id === selectedId.value) ?? null
})

const hasQr = computed(() => localTemplate.value?.elements.some((e) => e.type === 'qr') ?? false)

function select(id: string | null): void {
  selectedId.value = id
}

function addElement(kind: ElementKind): void {
  const t = localTemplate.value
  if (!t) return
  if (kind === 'qr' && hasQr.value) {
    toast.warning('Só é possível ter um QR code por etiqueta.')
    return
  }
  const el = createElement(kind, t)
  t.elements.push(el)
  selectedId.value = el.id
}

function removeElement(id: string): void {
  const t = localTemplate.value
  if (!t) return
  const index = t.elements.findIndex((e) => e.id === id)
  if (index < 0) return
  t.elements.splice(index, 1)
  if (selectedId.value === id) selectedId.value = null
}

function duplicateElement(id: string): void {
  const t = localTemplate.value
  if (!t) return
  const index = t.elements.findIndex((e) => e.id === id)
  if (index < 0) return
  const source = t.elements[index]
  if (source.type === 'qr') {
    toast.warning('Só é possível ter um QR code por etiqueta.')
    return
  }
  const copy = JSON.parse(JSON.stringify(source)) as LabelElement
  copy.id = newElementId()
  copy.x = round2(copy.x + 1)
  copy.y = round2(copy.y + 1)
  t.elements.splice(index + 1, 0, copy)
  selectedId.value = copy.id
}

function moveElement(id: string, delta: -1 | 1): void {
  const t = localTemplate.value
  if (!t) return
  const index = t.elements.findIndex((e) => e.id === id)
  const next = index + delta
  if (index < 0 || next < 0 || next >= t.elements.length) return
  const [el] = t.elements.splice(index, 1)
  t.elements.splice(next, 0, el)
}

const editorContext: EditorContext = {
  template: templateForContext,
  selectedId,
  selectedElement,
  matrixHeaders,
  headers,
  rowData,
  hasQr,
  select,
  addElement,
  removeElement,
  duplicateElement,
  moveElement
}
provide(EDITOR_CONTEXT, editorContext)

// ——— Carregamento ———

async function init(): Promise<void> {
  localTemplate.value = null
  selectedId.value = null
  savedJson.value = ''
  try {
    if (!settingsState.settings) await loadSettings()
  } catch {
    toast.error('Não foi possível carregar as configurações.')
    void router.replace('/configuracoes')
    return
  }
  if (!matrixState.loaded && !matrixState.loading) {
    void refreshMatrix().catch(() => {})
  }
  const id = String(route.params.id ?? '')
  const source = byId(id)
  if (!source) {
    toast.error('Modelo de etiqueta não encontrado.')
    void router.replace('/configuracoes')
    return
  }
  localTemplate.value = JSON.parse(JSON.stringify(source)) as LabelTemplate
  savedJson.value = JSON.stringify(localTemplate.value)
  resetHistory(savedJson.value)
}

watch(
  () => route.params.id,
  (next, prev) => {
    if (next && prev && next !== prev) void init()
  }
)

// ——— Salvar / descartar ———

function setName(v: string | number): void {
  if (localTemplate.value) localTemplate.value.name = String(v).slice(0, 60)
}

// ——— Redimensionar etiqueta com oferta de escalar os elementos ———

const scaleDialogOpen = ref(false)
/** Dimensões antes da primeira mudança do lote atual */
const scaleBaseline = ref<{ fromW: number; fromH: number } | null>(null)
let scalePromptTimer: number | undefined

function onDimsChange(apply: (t: LabelTemplate) => void): void {
  const t = localTemplate.value
  if (!t) return
  if (!scaleBaseline.value) scaleBaseline.value = { fromW: t.widthMm, fromH: t.heightMm }
  apply(t)
  window.clearTimeout(scalePromptTimer)
  scalePromptTimer = window.setTimeout(() => {
    const base = scaleBaseline.value
    const cur = localTemplate.value
    if (!base || !cur) return
    const changed = base.fromW !== cur.widthMm || base.fromH !== cur.heightMm
    if (!changed || cur.elements.length === 0) {
      scaleBaseline.value = null
      return
    }
    scaleDialogOpen.value = true
  }, 900)
}

function setWidth(v: number): void {
  onDimsChange((t) => {
    t.widthMm = round2(v)
  })
}

function setHeight(v: number): void {
  onDimsChange((t) => {
    t.heightMm = round2(v)
  })
}

function closeScaleDialog(): void {
  scaleDialogOpen.value = false
  scaleBaseline.value = null
}

/**
 * Escala os elementos do tamanho antigo para o novo: posições por eixo,
 * fontes/bordas/QR pelo fator uniforme (menor eixo) para não distorcer.
 */
function applyScaleElements(): void {
  const base = scaleBaseline.value
  const t = localTemplate.value
  if (!base || !t) return
  const sx = t.widthMm / base.fromW
  const sy = t.heightMm / base.fromH
  const s = Math.min(sx, sy)
  const between = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v))
  for (const el of t.elements) {
    el.x = round2(el.x * sx)
    el.y = round2(el.y * sy)
    if (el.type === 'box') {
      el.widthMm = round2(between(el.widthMm * sx, 0.5, 300))
      el.heightMm = round2(between(el.heightMm * sy, 0.5, 300))
      el.borderMm = round2(between(el.borderMm * s, 0.1, 2))
    } else if (el.type === 'qr') {
      el.sizeMm = round2(between(el.sizeMm * s, 3, 100))
    } else {
      el.fontSizeMm = round2(between(el.fontSizeMm * s, 0.8, 20))
      if (el.type === 'field') {
        el.borderMm = round2(between(el.borderMm * s, 0.1, 2))
        if (el.widthMm !== null) el.widthMm = round2(between(el.widthMm * sx, 1, 300))
        if (el.heightMm !== null) el.heightMm = round2(between(el.heightMm * sy, 1, 300))
      }
    }
  }
  closeScaleDialog()
  toast.success('Elementos escalados para o novo tamanho.')
}

async function save(): Promise<boolean> {
  const t = localTemplate.value
  if (!t || saving.value) return false
  if (!dirty.value) return true
  t.name = t.name.trim().slice(0, 60) || 'Sem nome'
  saving.value = true
  try {
    // snapshot único: mutações durante o IPC não podem ser marcadas como salvas
    const json = JSON.stringify(t)
    await upsert(JSON.parse(json) as LabelTemplate)
    savedJson.value = json
    toast.success('Modelo salvo.')
    return true
  } catch {
    toast.error('Não foi possível salvar o modelo.')
    return false
  } finally {
    saving.value = false
  }
}

function onSaveClick(): void {
  void save()
}

function discard(): void {
  if (!savedJson.value || !dirty.value) return
  localTemplate.value = JSON.parse(savedJson.value) as LabelTemplate
  if (selectedId.value && !localTemplate.value.elements.some((e) => e.id === selectedId.value)) {
    selectedId.value = null
  }
  toast.info('Alterações descartadas.')
}

function goBack(): void {
  void router.push('/configuracoes')
}

// ——— Guarda de saída ———

const leaveDialogOpen = ref(false)
let leaveResolver: ((ok: boolean) => void) | null = null

onBeforeRouteLeave(() => {
  if (!dirty.value) return true
  leaveDialogOpen.value = true
  return new Promise<boolean>((resolve) => {
    leaveResolver = resolve
  })
})

// Trocar /etiquetas/A/editar → /etiquetas/B/editar é update de params
// (não dispara onBeforeRouteLeave) mas também descarta o estado local
onBeforeRouteUpdate((to, from) => {
  if (to.params.id === from.params.id || !dirty.value) return true
  leaveDialogOpen.value = true
  return new Promise<boolean>((resolve) => {
    leaveResolver = resolve
  })
})

function settleLeave(ok: boolean): void {
  const resolve = leaveResolver
  leaveResolver = null
  leaveDialogOpen.value = false
  resolve?.(ok)
}

function onLeaveDialogOpenChange(open: boolean): void {
  if (!open) settleLeave(false)
}

async function saveAndLeave(): Promise<void> {
  settleLeave(await save())
}

function onSaveAndLeaveClick(): void {
  void saveAndLeave()
}

// ——— Atalho Ctrl+S ———

/** Campos de texto mantêm o desfazer/refazer nativo do input */
function isEditableTarget(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable === true)
}

function onWindowKeydown(e: KeyboardEvent): void {
  if (!e.ctrlKey || e.altKey) return
  const key = e.key.toLowerCase()
  if (!e.shiftKey && key === 's') {
    e.preventDefault()
    void save()
    return
  }
  if (isEditableTarget(e)) return
  if (!e.shiftKey && key === 'z') {
    e.preventDefault()
    undo()
  } else if (key === 'y' || (e.shiftKey && key === 'z')) {
    e.preventDefault()
    redo()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onWindowKeydown)
  void init()
})

onUnmounted(() => {
  window.removeEventListener('keydown', onWindowKeydown)
})
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Header -->
    <header class="flex shrink-0 items-center gap-3 border-b border-border bg-card/30 px-4 py-2">
      <Button variant="ghost" size="icon-sm" title="Voltar para configurações" @click="goBack">
        <ArrowLeft />
      </Button>
      <div class="h-8">
        <Separator orientation="vertical" />
      </div>

      <div class="flex min-w-0 flex-col gap-0.5">
        <span class="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Modelo
        </span>
        <Input
          v-if="localTemplate"
          :model-value="localTemplate.name"
          maxlength="60"
          title="Nome do modelo"
          class="h-7 w-64 border-transparent bg-transparent px-1.5 font-display text-sm font-semibold tracking-wide shadow-none hover:border-input"
          @update:model-value="setName"
        />
      </div>

      <div v-if="localTemplate" class="flex flex-col gap-0.5">
        <span class="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Etiqueta (mm)
        </span>
        <div class="flex items-center gap-1.5">
          <MmField
            id="tpl-width"
            :model-value="localTemplate.widthMm"
            :min="10"
            :max="300"
            :step="1"
            :digits="1"
            class="w-24"
            @update:model-value="setWidth"
          />
          <span class="text-xs text-muted-foreground">×</span>
          <MmField
            id="tpl-height"
            :model-value="localTemplate.heightMm"
            :min="5"
            :max="300"
            :step="1"
            :digits="1"
            class="w-24"
            @update:model-value="setHeight"
          />
        </div>
      </div>

      <div class="h-8">
        <Separator orientation="vertical" />
      </div>

      <div class="ml-auto flex items-center gap-2">
        <Badge
          v-if="dirty"
          variant="outline"
          class="rounded-sm border-warning/50 text-[10px] uppercase tracking-wider text-warning"
        >
          Não salvo
        </Badge>

        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="outline" size="sm" :disabled="!localTemplate">
              <Plus />
              Adicionar
              <ChevronDown class="opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem @select="addElement('field')">
              <Braces />
              Campo da matriz
            </DropdownMenuItem>
            <DropdownMenuItem @select="addElement('text')">
              <Type />
              Texto livre
            </DropdownMenuItem>
            <DropdownMenuItem @select="addElement('box')">
              <Square />
              Caixa / retângulo
            </DropdownMenuItem>
            <DropdownMenuItem :disabled="hasQr" @select="addElement('qr')">
              <QrCode />
              QR code
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon-sm"
          title="Desfazer (Ctrl+Z)"
          :disabled="!canUndo"
          @click="undo"
        >
          <Undo2 />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Refazer (Ctrl+Y)"
          :disabled="!canRedo"
          @click="redo"
        >
          <Redo2 />
        </Button>

        <Button variant="outline" size="sm" :disabled="!dirty || saving" @click="discard">
          <Undo2 />
          Descartar
        </Button>
        <Button size="sm" :disabled="!dirty || saving" title="Ctrl+S" @click="onSaveClick">
          <Save />
          Salvar
        </Button>
      </div>
    </header>

    <!-- Corpo: canvas + painel -->
    <div v-if="localTemplate" class="flex min-h-0 flex-1">
      <div class="min-w-0 flex-1">
        <EditorCanvas />
      </div>
      <aside class="flex w-72 shrink-0 flex-col border-l border-border bg-card/30">
        <ScrollArea class="min-h-0 flex-1">
          <PropertiesPanel />
          <Separator />
          <ElementsList />
        </ScrollArea>
      </aside>
    </div>

    <div v-else class="flex flex-1 items-center justify-center">
      <Spinner class="text-primary" />
    </div>

    <!-- Escalar elementos ao redimensionar a etiqueta -->
    <Dialog :open="scaleDialogOpen" @update:open="(v) => !v && closeScaleDialog()">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Escalar elementos?</DialogTitle>
          <DialogDescription>
            A etiqueta mudou de
            <span class="font-mono text-foreground">
              {{ scaleBaseline?.fromW ?? 0 }} × {{ scaleBaseline?.fromH ?? 0 }} mm
            </span>
            para
            <span class="font-mono text-foreground">
              {{ localTemplate?.widthMm ?? 0 }} × {{ localTemplate?.heightMm ?? 0 }} mm </span
            >. Quer escalar posições e tamanhos dos elementos proporcionalmente para preencher o
            novo tamanho?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="closeScaleDialog">Manter como estão</Button>
          <Button @click="applyScaleElements">Escalar elementos</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Guarda de saída -->
    <Dialog :open="leaveDialogOpen" @update:open="onLeaveDialogOpenChange">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alterações não salvas</DialogTitle>
          <DialogDescription>
            O modelo "{{ localTemplate?.name ?? 'Sem nome' }}" tem alterações que ainda não foram
            salvas. O que deseja fazer?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" @click="settleLeave(false)">Cancelar</Button>
          <Button variant="outline" @click="settleLeave(true)">Sair sem salvar</Button>
          <Button :disabled="saving" @click="onSaveAndLeaveClick">Salvar e sair</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
