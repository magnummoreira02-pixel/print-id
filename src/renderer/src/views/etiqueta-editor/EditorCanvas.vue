<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type CSSProperties } from 'vue'
import { Maximize, ZoomIn, ZoomOut } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { newElementId, normalizeLabelElement } from '@shared/labelTemplate'
import type { LabelElement } from '@shared/types'
import { useEditorContext } from './context'
import { clamp, formatMm, PX_PER_MM, round2, snap } from './editorUtils'
import ElementNode from './ElementNode.vue'

const ctx = useEditorContext()
const template = ctx.template

// Mínimo bem abaixo de 1×: etiquetas grandes (ex.: 100×150mm) precisam
// caber no viewport com o "Ajustar"
const MIN_ZOOM = 0.25
const MAX_ZOOM = 16

const region = ref<HTMLDivElement | null>(null)
const viewport = ref<HTMLDivElement | null>(null)
const zoom = ref(4)

interface DragState {
  mode: 'move' | 'resize'
  el: LabelElement
  startClientX: number
  startClientY: number
  startX: number
  startY: number
  startW: number
  startH: number
  startSize: number
  startFont: number
  /** Posição do readout flutuante, relativa à região do canvas */
  rx: number
  ry: number
}

const drag = ref<DragState | null>(null)

const zoomLabel = computed(() => `${zoom.value.toFixed(1).replace('.', ',')}×`)

function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))
}

function zoomIn(): void {
  zoom.value = clampZoom(round2(zoom.value * 1.25))
}

function zoomOut(): void {
  zoom.value = clampZoom(round2(zoom.value / 1.25))
}

/** Ajusta o zoom para a etiqueta caber no espaço visível */
function fitZoom(): void {
  const host = viewport.value
  if (!host) return
  const availW = host.clientWidth - 96
  const availH = host.clientHeight - 96
  if (availW <= 0 || availH <= 0) return
  const t = template.value
  const fit = Math.min(availW / (t.widthMm * PX_PER_MM), availH / (t.heightMm * PX_PER_MM))
  zoom.value = clampZoom(Math.floor(fit * 10) / 10)
}

let fitted = false
let observer: ResizeObserver | null = null

onMounted(() => {
  observer = new ResizeObserver(() => {
    if (!fitted && (viewport.value?.clientWidth ?? 0) > 0) {
      fitted = true
      fitZoom()
    }
  })
  if (viewport.value) observer.observe(viewport.value)
  void nextTick(() => {
    if (!fitted && (viewport.value?.clientWidth ?? 0) > 0) {
      fitted = true
      fitZoom()
    }
  })
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})

const stageStyle = computed<CSSProperties>(() => ({
  width: `${template.value.widthMm * PX_PER_MM * zoom.value}px`,
  height: `${template.value.heightMm * PX_PER_MM * zoom.value}px`
}))

const GRID_STRONG = 'oklch(0.52 0.05 240 / 0.4)'
const GRID_WEAK = 'oklch(0.55 0.05 240 / 0.22)'

/**
 * Superfície da etiqueta em mm reais, escalada via transform. Fonte Arial,
 * como na impressão — nunca a fonte do app. Grade de 1 mm (fraca) e 5 mm
 * (forte) desenhada no fundo; overflow visível para elementos fora da borda.
 */
const surfaceStyle = computed<CSSProperties>(() => ({
  position: 'relative',
  width: `${template.value.widthMm}mm`,
  height: `${template.value.heightMm}mm`,
  transform: `scale(${zoom.value})`,
  transformOrigin: 'top left',
  overflow: 'visible',
  touchAction: 'none',
  backgroundColor: '#fff',
  backgroundImage: [
    `repeating-linear-gradient(to right, ${GRID_STRONG} 0, ${GRID_STRONG} 0.06mm, transparent 0.06mm, transparent 5mm)`,
    `repeating-linear-gradient(to bottom, ${GRID_STRONG} 0, ${GRID_STRONG} 0.06mm, transparent 0.06mm, transparent 5mm)`,
    `repeating-linear-gradient(to right, ${GRID_WEAK} 0, ${GRID_WEAK} 0.04mm, transparent 0.04mm, transparent 1mm)`,
    `repeating-linear-gradient(to bottom, ${GRID_WEAK} 0, ${GRID_WEAK} 0.04mm, transparent 0.04mm, transparent 1mm)`
  ].join(', '),
  outline: `${1.5 / zoom.value}px solid oklch(0.7 0.03 240 / 0.9)`,
  boxShadow: `0 0 ${28 / zoom.value}px oklch(0 0 0 / 0.5)`,
  fontFamily: 'Arial, Helvetica, sans-serif',
  color: '#000'
}))

function elementFromEvent(e: PointerEvent): { el: LabelElement | null; resize: boolean } {
  const target = e.target as HTMLElement | null
  if (!target) return { el: null, resize: false }
  if (target.closest('[data-resize]')) return { el: ctx.selectedElement.value, resize: true }
  const host = target.closest<HTMLElement>('[data-el-id]')
  if (!host) return { el: null, resize: false }
  const id = host.dataset.elId ?? ''
  return { el: template.value.elements.find((x) => x.id === id) ?? null, resize: false }
}

function updateReadoutPos(state: DragState, e: PointerEvent): void {
  const rect = region.value?.getBoundingClientRect()
  if (!rect) return
  state.rx = e.clientX - rect.left + 14
  state.ry = e.clientY - rect.top + 18
}

function onPointerDown(e: PointerEvent): void {
  if (e.button !== 0) return
  viewport.value?.focus({ preventScroll: true })
  const { el, resize } = elementFromEvent(e)
  if (!el) {
    ctx.select(null)
    return
  }
  ctx.select(el.id)
  e.preventDefault()
  viewport.value?.setPointerCapture(e.pointerId)
  const state: DragState = {
    mode: resize ? 'resize' : 'move',
    el,
    startClientX: e.clientX,
    startClientY: e.clientY,
    startX: el.x,
    startY: el.y,
    startW: el.type === 'box' ? el.widthMm : el.type === 'field' ? (el.widthMm ?? 0) : 0,
    startH: el.type === 'box' ? el.heightMm : el.type === 'field' ? (el.heightMm ?? 0) : 0,
    startSize: el.type === 'qr' ? el.sizeMm : 0,
    startFont: el.type === 'field' || el.type === 'text' ? el.fontSizeMm : 0,
    rx: 0,
    ry: 0
  }
  updateReadoutPos(state, e)
  drag.value = state
}

function onPointerMove(e: PointerEvent): void {
  const state = drag.value
  if (!state) return
  updateReadoutPos(state, e)
  const dxMm = (e.clientX - state.startClientX) / (zoom.value * PX_PER_MM)
  const dyMm = (e.clientY - state.startClientY) / (zoom.value * PX_PER_MM)
  const el = state.el
  const t = template.value

  if (state.mode === 'move') {
    const step = e.altKey ? 0.05 : 0.5
    el.x = clamp(round2(snap(state.startX + dxMm, step)), -20, t.widthMm + 20)
    el.y = clamp(round2(snap(state.startY + dyMm, step)), -20, t.heightMm + 20)
    return
  }

  if (el.type === 'box') {
    el.widthMm = clamp(round2(snap(state.startW + dxMm, 0.1)), 0.5, 300)
    el.heightMm = clamp(round2(snap(state.startH + dyMm, 0.1)), 0.5, 300)
  } else if (el.type === 'qr') {
    el.sizeMm = clamp(round2(snap(state.startSize + Math.max(dxMm, dyMm), 0.1)), 3, 100)
  } else if (el.type === 'field' && (el.widthMm !== null || el.heightMm !== null)) {
    if (el.widthMm !== null) el.widthMm = clamp(round2(snap(state.startW + dxMm, 0.1)), 1, 300)
    if (el.heightMm !== null) el.heightMm = clamp(round2(snap(state.startH + dyMm, 0.1)), 1, 300)
  } else if (el.type === 'field' || el.type === 'text') {
    // Sem dimensões fixas: o arraste vertical ajusta o corpo da fonte
    el.fontSizeMm = clamp(round2(snap(state.startFont + dyMm, 0.1)), 0.8, 20)
  }
}

function endDrag(e: PointerEvent): void {
  if (drag.value && viewport.value?.hasPointerCapture(e.pointerId)) {
    viewport.value.releasePointerCapture(e.pointerId)
  }
  drag.value = null
}

const readout = computed<string>(() => {
  const state = drag.value
  if (!state) return ''
  const el = state.el
  if (state.mode === 'move') return `x: ${formatMm(el.x)}  y: ${formatMm(el.y)} mm`
  if (el.type === 'box') return `${formatMm(el.widthMm)} × ${formatMm(el.heightMm)} mm`
  if (el.type === 'qr') return `${formatMm(el.sizeMm)} mm`
  if (el.type === 'field' && (el.widthMm !== null || el.heightMm !== null)) {
    const w = el.widthMm !== null ? formatMm(el.widthMm) : 'auto'
    const h = el.heightMm !== null ? formatMm(el.heightMm) : 'auto'
    return `${w} × ${h} mm`
  }
  if (el.type === 'field' || el.type === 'text') return `fonte ${formatMm(el.fontSizeMm)} mm`
  return ''
})

// ——— Copiar/recortar/colar via área de transferência do sistema ———

async function copySelected(): Promise<void> {
  const el = ctx.selectedElement.value
  if (!el) return
  try {
    await navigator.clipboard.writeText(JSON.stringify({ printIdElement: 1, element: el }))
  } catch {
    toast.error('Não foi possível copiar o elemento.')
  }
}

async function pasteElement(): Promise<void> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await navigator.clipboard.readText())
  } catch {
    return
  }
  const raw =
    typeof parsed === 'object' && parsed !== null && 'printIdElement' in parsed
      ? (parsed as { element?: unknown }).element
      : null
  const el = normalizeLabelElement(raw)
  if (!el) return
  if (el.type === 'qr' && ctx.hasQr.value) {
    toast.warning('Só é possível ter um QR code por etiqueta.')
    return
  }
  el.id = newElementId()
  el.x = round2(el.x + 2)
  el.y = round2(el.y + 2)
  template.value.elements.push(el)
  ctx.select(el.id)
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    ctx.select(null)
    return
  }
  if (e.ctrlKey && e.key.toLowerCase() === 'v') {
    e.preventDefault()
    void pasteElement()
    return
  }
  const el = ctx.selectedElement.value
  if (!el) return
  if (e.ctrlKey && e.key.toLowerCase() === 'c') {
    e.preventDefault()
    void copySelected()
    return
  }
  if (e.ctrlKey && e.key.toLowerCase() === 'x') {
    e.preventDefault()
    void copySelected().then(() => ctx.removeElement(el.id))
    return
  }
  if (e.ctrlKey && e.key.toLowerCase() === 'd') {
    e.preventDefault()
    ctx.duplicateElement(el.id)
    return
  }
  if (e.key === 'Delete') {
    e.preventDefault()
    ctx.removeElement(el.id)
    return
  }
  const step = e.shiftKey ? 1 : 0.1
  let dx = 0
  let dy = 0
  if (e.key === 'ArrowLeft') dx = -step
  else if (e.key === 'ArrowRight') dx = step
  else if (e.key === 'ArrowUp') dy = -step
  else if (e.key === 'ArrowDown') dy = step
  else return
  e.preventDefault()
  const t = template.value
  el.x = clamp(round2(el.x + dx), -20, t.widthMm + 20)
  el.y = clamp(round2(el.y + dy), -20, t.heightMm + 20)
}

function onWheel(e: WheelEvent): void {
  if (!e.ctrlKey) return
  e.preventDefault()
  // Mudar o zoom no meio de um arraste reescalaria o delta acumulado
  // e faria o elemento saltar
  if (drag.value) return
  const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2
  zoom.value = clampZoom(round2(zoom.value * factor))
}

// Seleção vinda da lista: garante o elemento à vista no canvas.
// Durante um arraste a seleção veio do próprio canvas — rolar aqui
// deslocaria o viewport no meio do gesto.
watch(
  () => ctx.selectedId.value,
  (id) => {
    if (!id || drag.value) return
    void nextTick(() => {
      viewport.value
        ?.querySelector(`[data-el-id="${CSS.escape(id)}"]`)
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    })
  }
)
</script>

<template>
  <div ref="region" class="relative h-full min-h-0">
    <div
      ref="viewport"
      tabindex="0"
      class="absolute inset-0 overflow-auto bg-blueprint focus:outline-none"
      :style="drag ? { cursor: drag.mode === 'move' ? 'move' : 'nwse-resize' } : undefined"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="endDrag"
      @pointercancel="endDrag"
      @keydown="onKeydown"
      @wheel="onWheel"
    >
      <div class="flex min-h-full w-max min-w-full">
        <div class="m-auto p-12">
          <div :style="stageStyle">
            <div :style="surfaceStyle">
              <ElementNode v-for="el in template.elements" :key="el.id" :el="el" :zoom="zoom" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Controles de zoom -->
    <div
      class="absolute bottom-3 right-3 flex items-center gap-1 rounded-md border border-border bg-card/95 p-1 shadow-lg"
    >
      <Button variant="ghost" size="icon-xs" title="Reduzir zoom" @click="zoomOut">
        <ZoomOut />
      </Button>
      <span class="w-11 text-center font-mono text-[10px] text-muted-foreground">
        {{ zoomLabel }}
      </span>
      <Button variant="ghost" size="icon-xs" title="Ampliar zoom (Ctrl+roda)" @click="zoomIn">
        <ZoomIn />
      </Button>
      <div class="h-4">
        <Separator orientation="vertical" />
      </div>
      <Button variant="ghost" size="xs" title="Ajustar ao espaço disponível" @click="fitZoom">
        <Maximize />
        Ajustar
      </Button>
    </div>

    <!-- Readout flutuante durante o arraste -->
    <div
      v-if="drag"
      class="pointer-events-none absolute z-20 whitespace-pre rounded border border-border bg-popover px-1.5 py-0.5 font-mono text-[10px] text-foreground shadow-md"
      :style="{ left: `${drag.rx}px`, top: `${drag.ry}px` }"
    >
      {{ readout }}
    </div>
  </div>
</template>
