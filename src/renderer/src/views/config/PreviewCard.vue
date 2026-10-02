<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RefreshCw } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { useSettings } from '@/composables/useSettings'
import ConfigCard from './ConfigCard.vue'

/** 1 mm em pixels CSS (96 dpi). */
const PX_PER_MM = 96 / 25.4

const { state: settingsState } = useSettings()

const html = ref('')
const loading = ref(false)
const failed = ref(false)

// Sem scroll dentro do iframe: arredondamento subpixel das medidas em mm
// gera overflow de 1px. Só na prévia — a impressão usa o HTML original.
const previewHtml = computed(() =>
  html.value.replace('</head>', '<style>html, body { overflow: hidden; }</style></head>')
)

const activeTemplate = computed(() => {
  const s = settingsState.settings
  if (!s) return null
  return s.templates.find((t) => t.id === s.activeTemplateId) ?? s.templates[0] ?? null
})
const widthMm = computed(() => activeTemplate.value?.widthMm ?? 50)
const heightMm = computed(() => activeTemplate.value?.heightMm ?? 25)
const templateJson = computed(() => JSON.stringify(activeTemplate.value ?? null))

const viewport = ref<HTMLDivElement | null>(null)
const viewportWidth = ref(0)
let observer: ResizeObserver | null = null

/** Zoom visual: preenche a largura disponível, limitado a ~4x.
 *  Etiquetas largas reduzem abaixo de 1x para nunca serem cortadas. */
const scale = computed(() => {
  const natural = widthMm.value * PX_PER_MM
  if (viewportWidth.value <= 0 || natural <= 0) return 3
  const fit = viewportWidth.value / natural
  return Math.min(4, Math.max(0.2, Math.floor(fit * 100) / 100))
})

const stageStyle = computed(() => ({
  width: `${widthMm.value * PX_PER_MM * scale.value}px`,
  height: `${heightMm.value * PX_PER_MM * scale.value}px`
}))

const frameStyle = computed(() => ({
  width: `${widthMm.value}mm`,
  height: `${heightMm.value}mm`,
  transform: `scale(${scale.value})`,
  transformOrigin: 'top left'
}))

let requestId = 0

async function loadPreview(): Promise<void> {
  const id = ++requestId
  loading.value = true
  try {
    const result = await window.api.previewLabels([])
    if (id !== requestId) return
    html.value = result
    failed.value = false
  } catch {
    if (id !== requestId) return
    failed.value = true
    toast.error('Não foi possível carregar a prévia da etiqueta.')
  } finally {
    if (id === requestId) loading.value = false
  }
}

watch([widthMm, heightMm, templateJson], () => {
  void loadPreview()
})

onMounted(() => {
  void loadPreview()
  if (viewport.value) {
    observer = new ResizeObserver((entries) => {
      viewportWidth.value = entries[0]?.contentRect.width ?? 0
    })
    observer.observe(viewport.value)
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})
</script>

<template>
  <ConfigCard title="Prévia">
    <template #action>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Recarregar prévia da etiqueta"
        :disabled="loading"
        @click="loadPreview"
      >
        <RefreshCw :class="loading ? 'animate-spin' : ''" />
      </Button>
    </template>

    <div class="flex flex-col gap-3">
      <div
        ref="viewport"
        class="relative flex items-start justify-center overflow-hidden rounded-md border border-border bg-muted/30 p-4"
      >
        <Skeleton v-if="!html && loading" :style="stageStyle" class="max-w-full rounded-none" />

        <div
          v-else-if="!html && failed"
          class="flex w-full flex-col items-center gap-1 bg-blueprint py-8 text-center"
        >
          <p class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Prévia indisponível
          </p>
          <p class="text-xs text-muted-foreground">Recarregue para tentar novamente.</p>
        </div>

        <div v-else class="max-w-full overflow-hidden" :style="stageStyle">
          <iframe
            :srcdoc="previewHtml"
            sandbox=""
            title="Prévia da etiqueta"
            class="pointer-events-none block bg-white outline outline-1 outline-border"
            :style="frameStyle"
          />
        </div>

        <div
          v-if="html && loading"
          class="absolute inset-0 flex items-center justify-center bg-background/50"
        >
          <Spinner class="text-primary" />
        </div>
      </div>

      <div class="flex items-center justify-between gap-3">
        <div class="flex flex-col">
          <span class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Dimensões
          </span>
          <span class="font-mono text-sm text-foreground/90">
            {{ widthMm }} × {{ heightMm }} mm
          </span>
        </div>
        <div class="flex flex-col items-end">
          <span class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Zoom
          </span>
          <span class="font-mono text-sm text-foreground/90">{{ scale.toFixed(1) }}×</span>
        </div>
      </div>

      <p class="border-t border-border pt-2.5 text-xs text-muted-foreground">
        Renderização real do modelo enviado à impressora.
      </p>
    </div>
  </ConfigCard>
</template>
