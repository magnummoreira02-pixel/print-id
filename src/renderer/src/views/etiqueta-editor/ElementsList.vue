<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Braces, ChevronDown, ChevronUp, Eye, EyeOff, QrCode, Square, Type } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import type { LabelElement } from '@shared/types'
import { useEditorContext, type ElementKind } from './context'
import { describeElement } from './editorUtils'

const ctx = useEditorContext()
const template = ctx.template
const selectedId = ctx.selectedId

const elements = computed(() => template.value.elements)

const ICONS: Record<ElementKind, typeof Type> = {
  field: Braces,
  text: Type,
  box: Square,
  qr: QrCode
}

const listEl = ref<HTMLDivElement | null>(null)

function toggleVisible(el: LabelElement): void {
  el.visible = !el.visible
}

// Seleção vinda do canvas: mantém a linha correspondente à vista
watch(
  () => selectedId.value,
  (id) => {
    if (!id) return
    void nextTick(() => {
      listEl.value
        ?.querySelector(`[data-row-id="${CSS.escape(id)}"]`)
        ?.scrollIntoView({ block: 'nearest' })
    })
  }
)
</script>

<template>
  <div class="flex flex-col gap-1.5 p-3">
    <div class="flex items-baseline justify-between">
      <h3 class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Elementos
      </h3>
      <span class="font-mono text-[10px] text-muted-foreground">{{ elements.length }}</span>
    </div>

    <div ref="listEl" class="flex flex-col">
      <div
        v-for="(el, index) in elements"
        :key="el.id"
        :data-row-id="el.id"
        class="flex cursor-pointer items-center gap-1.5 border-l-2 py-0.5 pl-1.5 text-xs transition-colors"
        :class="
          selectedId === el.id
            ? 'border-primary bg-accent/60 text-foreground'
            : 'border-transparent text-muted-foreground hover:bg-accent/30 hover:text-foreground'
        "
        @click="ctx.select(el.id)"
      >
        <component
          :is="ICONS[el.type]"
          class="size-3.5 shrink-0"
          :class="el.visible ? '' : 'opacity-40'"
        />
        <span
          class="min-w-0 flex-1 truncate font-mono text-[11px]"
          :class="el.visible ? '' : 'opacity-50'"
          :title="describeElement(el)"
        >
          {{ describeElement(el) }}
        </span>
        <div class="flex shrink-0 items-center">
          <Button
            variant="ghost"
            size="icon-xs"
            title="Mover para trás"
            :disabled="index === 0"
            @click.stop="ctx.moveElement(el.id, -1)"
          >
            <ChevronUp />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            title="Mover para a frente"
            :disabled="index === elements.length - 1"
            @click.stop="ctx.moveElement(el.id, 1)"
          >
            <ChevronDown />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            :title="el.visible ? 'Ocultar' : 'Exibir'"
            @click.stop="toggleVisible(el)"
          >
            <Eye v-if="el.visible" />
            <EyeOff v-else class="opacity-60" />
          </Button>
        </div>
      </div>
    </div>

    <p class="pt-0.5 text-[10px] text-muted-foreground">Itens no fim da lista ficam por cima.</p>
  </div>
</template>
