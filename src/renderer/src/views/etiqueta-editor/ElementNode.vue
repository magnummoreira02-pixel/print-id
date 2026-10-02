<script setup lang="ts">
import { computed, shallowRef, type CSSProperties, type Ref } from 'vue'
import type { LabelElement } from '@shared/types'
import { useEditorContext } from './context'
import { elementStyle, fieldValue, qrValue } from './labelRender'
import { useQrDataUrl } from './useQrDataUrl'

const props = defineProps<{ el: LabelElement; zoom: number }>()

const ctx = useEditorContext()

const selected = computed(() => ctx.selectedId.value === props.el.id)

const content = computed<string>(() => {
  const el = props.el
  if (el.type === 'text') return el.text
  if (el.type === 'field') return fieldValue(el, ctx.rowData.value, ctx.headers.value)
  return ''
})

/** Campo sem valor: placeholder esmaecido, mas ainda clicável/arrastável */
const isEmptyField = computed(() => props.el.type === 'field' && content.value === '')

const qrContent = computed<string>(() => {
  const el = props.el
  if (el.type !== 'qr') return ''
  return qrValue(el.columns, el.separator, ctx.rowData.value, ctx.headers.value)
})

// O tipo de um elemento nunca muda; a criação condicional do composable é segura
const qrUrl: Ref<string | null> =
  props.el.type === 'qr' ? useQrDataUrl(() => qrContent.value) : shallowRef(null)

/** Espessura de traço que aparenta ~1,4 px na tela, independente do zoom */
const hairline = computed(() => 1.4 / props.zoom)

const style = computed<CSSProperties>(() => {
  const s = elementStyle(props.el)
  s.cursor = 'move'
  if (!props.el.visible) s.opacity = '0.25'
  if (selected.value) {
    s.outline = `${hairline.value}px solid var(--primary)`
    s.outlineOffset = `${hairline.value}px`
  } else if (!props.el.visible) {
    s.outline = `${hairline.value}px dashed rgba(0, 0, 0, 0.45)`
    s.outlineOffset = `${hairline.value}px`
  }
  return s
})

const handleStyle = computed<CSSProperties>(() => ({
  position: 'absolute',
  right: '0',
  bottom: '0',
  width: `${9 / props.zoom}px`,
  height: `${9 / props.zoom}px`,
  transform: 'translate(50%, 50%)',
  background: 'var(--primary)',
  border: `${1 / props.zoom}px solid var(--primary-foreground)`,
  borderRadius: `${2 / props.zoom}px`,
  cursor: 'nwse-resize',
  zIndex: 5
}))
</script>

<template>
  <div :data-el-id="el.id" :style="style">
    <span
      v-if="el.type === 'text' || el.type === 'field'"
      :style="isEmptyField ? { color: '#9ca3af' } : undefined"
      >{{ isEmptyField ? '«campo»' : content }}</span
    >
    <template v-if="el.type === 'qr'">
      <img
        v-if="qrUrl"
        :src="qrUrl"
        alt=""
        draggable="false"
        style="width: 100%; height: 100%; image-rendering: pixelated; display: block"
      />
      <div v-else style="width: 100%; height: 100%; border: 0.3mm dashed #9ca3af"></div>
    </template>
    <div v-if="selected" data-resize :style="handleStyle"></div>
  </div>
</template>
