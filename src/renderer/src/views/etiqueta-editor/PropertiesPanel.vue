<script setup lang="ts">
import { computed } from 'vue'
import { Copy, MousePointerClick, Trash2 } from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { LABEL_FIELD_NAMES } from '@shared/labelTemplate'
import type {
  LabelBoxElement,
  LabelFieldElement,
  LabelQrElement,
  LabelRotation,
  LabelTextElement
} from '@shared/types'
import ColumnsComposer from './ColumnsComposer.vue'
import { useEditorContext } from './context'
import { round2, TYPE_LABELS } from './editorUtils'
import MmField from './MmField.vue'

const ctx = useEditorContext()
const template = ctx.template

const current = ctx.selectedElement
const field = computed<LabelFieldElement | null>(() =>
  current.value?.type === 'field' ? current.value : null
)
const textEl = computed<LabelTextElement | null>(() =>
  current.value?.type === 'text' ? current.value : null
)
const boxEl = computed<LabelBoxElement | null>(() =>
  current.value?.type === 'box' ? current.value : null
)
const qrEl = computed<LabelQrElement | null>(() =>
  current.value?.type === 'qr' ? current.value : null
)

const maxX = computed(() => template.value.widthMm + 20)
const maxY = computed(() => template.value.heightMm + 20)

const stats = computed(() => {
  const els = template.value.elements
  return { total: els.length, hidden: els.filter((e) => !e.visible).length }
})

const fieldAutoNames = computed(() =>
  field.value ? field.value.autos.map((a) => LABEL_FIELD_NAMES[a]) : []
)
/** Quantidade efetiva de colunas (explícitas ou autos) — controla o separador */
const fieldColumnCount = computed(() => {
  const f = field.value
  if (!f) return 0
  return f.columns.length > 0 ? f.columns.length : f.autos.length
})

const typeBadge = computed(() => (current.value ? TYPE_LABELS[current.value.type] : ''))

const ALIGN_LABELS: Record<string, string> = {
  left: 'Esquerda',
  center: 'Centro',
  right: 'Direita'
}
const ROTATION_LABELS: Record<string, string> = {
  '0': 'Horizontal',
  '90': 'Vertical ↓',
  '270': 'Vertical ↑'
}

// ——— Setters (mutações passam pelo script para manter o template limpo) ———

function setX(v: number): void {
  if (current.value) current.value.x = round2(v)
}
function setY(v: number): void {
  if (current.value) current.value.y = round2(v)
}
function setVisible(v: boolean): void {
  if (current.value) current.value.visible = v
}
function setFieldColumns(cols: string[]): void {
  if (field.value) field.value.columns = cols
}
function setSeparator(v: string | number): void {
  if (field.value) field.value.separator = String(v).slice(0, 8)
}
function setPrefix(v: string | number): void {
  if (field.value) field.value.prefix = String(v).slice(0, 24)
}
function setFont(v: number): void {
  const e = field.value ?? textEl.value
  if (e) e.fontSizeMm = round2(v)
}
function setBold(v: boolean): void {
  const e = field.value ?? textEl.value
  if (e) e.bold = v
}
function setAlign(value: unknown): void {
  if (!field.value) return
  if (value === 'left' || value === 'center' || value === 'right') field.value.align = value
}
function setRotation(value: unknown): void {
  const e = field.value ?? textEl.value
  if (!e) return
  const n = Number(value)
  if (n === 0 || n === 90 || n === 270) e.rotation = n as LabelRotation
}
function setBoxed(v: boolean): void {
  if (field.value) field.value.boxed = v
}
function setBorder(v: number): void {
  const e = field.value ?? boxEl.value
  if (e) e.borderMm = round2(v)
}
function toggleFixedWidth(on: boolean): void {
  if (field.value) field.value.widthMm = on ? (field.value.widthMm ?? 10) : null
}
function setFixedWidth(v: number): void {
  if (field.value) field.value.widthMm = round2(v)
}
function toggleFixedHeight(on: boolean): void {
  if (field.value) field.value.heightMm = on ? (field.value.heightMm ?? 4) : null
}
function setFixedHeight(v: number): void {
  if (field.value) field.value.heightMm = round2(v)
}
function setText(v: string | number): void {
  if (textEl.value) textEl.value.text = String(v).slice(0, 120)
}
function setBoxWidth(v: number): void {
  if (boxEl.value) boxEl.value.widthMm = round2(v)
}
function setBoxHeight(v: number): void {
  if (boxEl.value) boxEl.value.heightMm = round2(v)
}
function setQrSize(v: number): void {
  if (qrEl.value) qrEl.value.sizeMm = round2(v)
}
function setQrColumns(cols: string[]): void {
  if (qrEl.value) qrEl.value.columns = cols
}
function setQrSeparator(v: string | number): void {
  if (qrEl.value) qrEl.value.separator = String(v).slice(0, 3)
}

function duplicate(): void {
  if (current.value) ctx.duplicateElement(current.value.id)
}
function remove(): void {
  if (current.value) ctx.removeElement(current.value.id)
}
</script>

<template>
  <div class="flex flex-col gap-3 p-3">
    <!-- Sem seleção -->
    <template v-if="!current">
      <div class="flex flex-col items-center gap-2 py-6 text-center">
        <MousePointerClick class="size-5 text-muted-foreground/60" />
        <p class="text-xs text-muted-foreground">Clique num elemento para editar.</p>
        <p class="font-mono text-[10px] text-muted-foreground">
          {{ stats.total }} elementos · {{ stats.hidden }} ocultos
        </p>
      </div>
      <Separator />
      <div class="flex flex-col gap-1.5">
        <h3 class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Atalhos
        </h3>
        <div class="flex flex-col gap-1 text-[11px] text-muted-foreground">
          <div class="flex items-center justify-between gap-2">
            <span>Mover 0,1 mm</span>
            <Kbd class="text-[9px]">Setas</Kbd>
          </div>
          <div class="flex items-center justify-between gap-2">
            <span>Mover 1 mm</span>
            <Kbd class="text-[9px]">Shift+Setas</Kbd>
          </div>
          <div class="flex items-center justify-between gap-2">
            <span>Duplicar</span>
            <Kbd class="text-[9px]">Ctrl+D</Kbd>
          </div>
          <div class="flex items-center justify-between gap-2">
            <span>Copiar / Recortar</span>
            <Kbd class="text-[9px]">Ctrl+C / X</Kbd>
          </div>
          <div class="flex items-center justify-between gap-2">
            <span>Colar</span>
            <Kbd class="text-[9px]">Ctrl+V</Kbd>
          </div>
          <div class="flex items-center justify-between gap-2">
            <span>Desfazer / Refazer</span>
            <Kbd class="text-[9px]">Ctrl+Z / Y</Kbd>
          </div>
          <div class="flex items-center justify-between gap-2">
            <span>Excluir</span>
            <Kbd class="text-[9px]">Delete</Kbd>
          </div>
          <div class="flex items-center justify-between gap-2">
            <span>Zoom</span>
            <Kbd class="text-[9px]">Ctrl+roda</Kbd>
          </div>
          <div class="flex items-center justify-between gap-2">
            <span>Salvar</span>
            <Kbd class="text-[9px]">Ctrl+S</Kbd>
          </div>
        </div>
      </div>
    </template>

    <!-- Elemento selecionado -->
    <template v-else>
      <div class="flex items-center gap-2">
        <Badge variant="outline" class="rounded-sm text-[10px] uppercase tracking-wider">
          {{ typeBadge }}
        </Badge>
        <div class="ml-auto flex items-center">
          <Button
            variant="ghost"
            size="icon-xs"
            :disabled="current.type === 'qr'"
            :title="current.type === 'qr' ? 'Só um QR por etiqueta' : 'Duplicar (Ctrl+D)'"
            @click="duplicate"
          >
            <Copy />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            class="text-destructive hover:bg-destructive/10 hover:text-destructive"
            title="Excluir (Delete)"
            @click="remove"
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      <!-- Posição / visibilidade (comum) -->
      <div class="grid grid-cols-2 gap-2">
        <MmField
          id="prop-x"
          label="X (mm)"
          :model-value="current.x"
          :min="-20"
          :max="maxX"
          :step="0.1"
          @update:model-value="setX"
        />
        <MmField
          id="prop-y"
          label="Y (mm)"
          :model-value="current.y"
          :min="-20"
          :max="maxY"
          :step="0.1"
          @update:model-value="setY"
        />
      </div>
      <div class="flex items-center justify-between">
        <Label
          for="prop-visible"
          class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
        >
          Exibir
        </Label>
        <Switch id="prop-visible" :model-value="current.visible" @update:model-value="setVisible" />
      </div>

      <!-- Campo da matriz -->
      <template v-if="field">
        <Separator />
        <div class="flex flex-col gap-1.5">
          <h3 class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Colunas
          </h3>
          <ColumnsComposer
            :columns="field.columns"
            :autos="fieldAutoNames"
            auto-hint="Automático por safra — colunas resolvidas pelo nome."
            @update:columns="setFieldColumns"
          />
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div v-if="fieldColumnCount > 1" class="flex flex-col gap-1">
            <Label
              for="prop-separator"
              class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
            >
              Separador
            </Label>
            <Input
              id="prop-separator"
              :model-value="field.separator"
              maxlength="8"
              class="h-8 font-mono text-xs"
              @update:model-value="setSeparator"
            />
          </div>
          <div class="flex flex-col gap-1">
            <Label
              for="prop-prefix"
              class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
            >
              Prefixo
            </Label>
            <Input
              id="prop-prefix"
              :model-value="field.prefix"
              maxlength="24"
              placeholder="Ex.: Q-"
              class="h-8 font-mono text-xs"
              @update:model-value="setPrefix"
            />
          </div>
        </div>

        <Separator />
        <div class="grid grid-cols-2 items-end gap-2">
          <MmField
            id="prop-font"
            label="Fonte (mm)"
            :model-value="field.fontSizeMm"
            :min="0.8"
            :max="20"
            :step="0.2"
            @update:model-value="setFont"
          />
          <div class="flex h-8 items-center justify-between">
            <Label
              for="prop-bold"
              class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
            >
              Negrito
            </Label>
            <Switch id="prop-bold" :model-value="field.bold" @update:model-value="setBold" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div class="flex flex-col gap-1">
            <Label
              class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
            >
              Alinhamento
            </Label>
            <Select
              :model-value="field.align"
              :disabled="field.widthMm === null && field.heightMm === null"
              @update:model-value="setAlign"
            >
              <SelectTrigger class="h-8 w-full text-xs">
                <SelectValue>{{ ALIGN_LABELS[field.align] }}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="left" class="text-xs">Esquerda</SelectItem>
                <SelectItem value="center" class="text-xs">Centro</SelectItem>
                <SelectItem value="right" class="text-xs">Direita</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="flex flex-col gap-1">
            <Label
              class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
            >
              Rotação
            </Label>
            <Select :model-value="String(field.rotation)" @update:model-value="setRotation">
              <SelectTrigger class="h-8 w-full text-xs">
                <SelectValue>{{ ROTATION_LABELS[String(field.rotation)] }}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0" class="text-xs">Horizontal</SelectItem>
                <SelectItem value="90" class="text-xs">Vertical ↓</SelectItem>
                <SelectItem value="270" class="text-xs">Vertical ↑</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />
        <div class="flex items-center justify-between">
          <Label
            for="prop-boxed"
            class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
          >
            Caixa / borda
          </Label>
          <Switch id="prop-boxed" :model-value="field.boxed" @update:model-value="setBoxed" />
        </div>
        <MmField
          v-if="field.boxed"
          id="prop-border"
          label="Espessura (mm)"
          :model-value="field.borderMm"
          :min="0.1"
          :max="2"
          :step="0.05"
          @update:model-value="setBorder"
        />

        <Separator />
        <div class="flex items-center justify-between">
          <Label
            for="prop-fixed-w"
            class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
          >
            Largura fixa
          </Label>
          <Switch
            id="prop-fixed-w"
            :model-value="field.widthMm !== null"
            @update:model-value="toggleFixedWidth"
          />
        </div>
        <MmField
          v-if="field.widthMm !== null"
          id="prop-width"
          label="Largura (mm)"
          :model-value="field.widthMm"
          :min="1"
          :max="300"
          :step="0.5"
          @update:model-value="setFixedWidth"
        />
        <div class="flex items-center justify-between">
          <Label
            for="prop-fixed-h"
            class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
          >
            Altura fixa
          </Label>
          <Switch
            id="prop-fixed-h"
            :model-value="field.heightMm !== null"
            @update:model-value="toggleFixedHeight"
          />
        </div>
        <MmField
          v-if="field.heightMm !== null"
          id="prop-height"
          label="Altura (mm)"
          :model-value="field.heightMm"
          :min="1"
          :max="300"
          :step="0.5"
          @update:model-value="setFixedHeight"
        />
        <p class="text-[10px] text-muted-foreground">Sem dimensão fixa, ajusta ao conteúdo.</p>
      </template>

      <!-- Texto livre -->
      <template v-else-if="textEl">
        <Separator />
        <div class="flex flex-col gap-1">
          <Label
            for="prop-text"
            class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
          >
            Texto
          </Label>
          <Input
            id="prop-text"
            :model-value="textEl.text"
            maxlength="120"
            class="h-8 font-mono text-xs"
            @update:model-value="setText"
          />
        </div>
        <div class="grid grid-cols-2 items-end gap-2">
          <MmField
            id="prop-font"
            label="Fonte (mm)"
            :model-value="textEl.fontSizeMm"
            :min="0.8"
            :max="20"
            :step="0.2"
            @update:model-value="setFont"
          />
          <div class="flex h-8 items-center justify-between">
            <Label
              for="prop-bold"
              class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
            >
              Negrito
            </Label>
            <Switch id="prop-bold" :model-value="textEl.bold" @update:model-value="setBold" />
          </div>
        </div>
        <div class="flex flex-col gap-1">
          <Label class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Rotação
          </Label>
          <Select :model-value="String(textEl.rotation)" @update:model-value="setRotation">
            <SelectTrigger class="h-8 w-full text-xs">
              <SelectValue>{{ ROTATION_LABELS[String(textEl.rotation)] }}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0" class="text-xs">Horizontal</SelectItem>
              <SelectItem value="90" class="text-xs">Vertical ↓</SelectItem>
              <SelectItem value="270" class="text-xs">Vertical ↑</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </template>

      <!-- Caixa / retângulo -->
      <template v-else-if="boxEl">
        <Separator />
        <div class="grid grid-cols-2 gap-2">
          <MmField
            id="box-w"
            label="Largura (mm)"
            :model-value="boxEl.widthMm"
            :min="0.5"
            :max="300"
            :step="0.5"
            @update:model-value="setBoxWidth"
          />
          <MmField
            id="box-h"
            label="Altura (mm)"
            :model-value="boxEl.heightMm"
            :min="0.5"
            :max="300"
            :step="0.5"
            @update:model-value="setBoxHeight"
          />
        </div>
        <MmField
          id="box-border"
          label="Espessura da borda (mm)"
          :model-value="boxEl.borderMm"
          :min="0.1"
          :max="2"
          :step="0.05"
          @update:model-value="setBorder"
        />
      </template>

      <!-- QR code -->
      <template v-else-if="qrEl">
        <Separator />
        <MmField
          id="qr-size"
          label="Tamanho (mm)"
          :model-value="qrEl.sizeMm"
          :min="3"
          :max="100"
          :step="0.5"
          @update:model-value="setQrSize"
        />
        <div class="flex flex-col gap-1.5">
          <h3 class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Conteúdo
          </h3>
          <ColumnsComposer
            :columns="qrEl.columns"
            auto-hint="Vazio = usa a coluna do ID."
            @update:columns="setQrColumns"
          />
        </div>
        <div v-if="qrEl.columns.length > 1" class="flex flex-col gap-1">
          <Label
            for="qr-separator"
            class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
          >
            Separador
          </Label>
          <Input
            id="qr-separator"
            :model-value="qrEl.separator"
            maxlength="3"
            class="h-8 w-20 font-mono text-xs"
            @update:model-value="setQrSeparator"
          />
        </div>
      </template>
    </template>
  </div>
</template>
