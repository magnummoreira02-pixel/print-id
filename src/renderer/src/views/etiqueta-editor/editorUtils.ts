import { LABEL_FIELD_NAMES, newElementId } from '@shared/labelTemplate'
import type { LabelElement, LabelTemplate } from '@shared/types'
import type { ElementKind } from './context'

/** 1 mm em pixels CSS (96 dpi) */
export const PX_PER_MM = 96 / 25.4

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

/** Arredonda para 2 casas — evita deriva de ponto flutuante nas posições */
export function round2(v: number): number {
  return Math.round(v * 100) / 100
}

export function snap(v: number, step: number): number {
  return Math.round(v / step) * step
}

/** Medida em mm formatada em pt-BR (ex.: "12,5") */
export function formatMm(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })
}

export const TYPE_LABELS: Record<ElementKind, string> = {
  field: 'Campo',
  text: 'Texto',
  box: 'Caixa',
  qr: 'QR code'
}

/** Elemento novo com os mesmos padrões do normalizeElement do shared */
export function createElement(kind: ElementKind, template: LabelTemplate): LabelElement {
  const base = { id: newElementId(), x: 3, y: 3, visible: true }
  switch (kind) {
    case 'field':
      return {
        ...base,
        type: 'field',
        autos: ['id'],
        columns: [],
        separator: ' - ',
        prefix: '',
        fontSizeMm: 2.6,
        bold: true,
        align: 'left',
        rotation: 0,
        boxed: false,
        borderMm: 0.45,
        widthMm: null,
        heightMm: null
      }
    case 'text':
      return {
        ...base,
        type: 'text',
        text: 'Texto',
        fontSizeMm: 2.6,
        bold: true,
        align: 'left',
        rotation: 0
      }
    case 'box':
      return { ...base, type: 'box', widthMm: 10, heightMm: 5, borderMm: 0.45 }
    case 'qr':
      return {
        ...base,
        type: 'qr',
        x: Math.max(1, round2(template.widthMm - 11)),
        y: 2,
        sizeMm: 9,
        columns: [],
        separator: ';'
      }
  }
}

/** Nome descritivo do elemento para a lista de empilhamento */
export function describeElement(el: LabelElement): string {
  switch (el.type) {
    case 'text': {
      const t = el.text.trim() || 'Texto'
      return t.length > 24 ? `${t.slice(0, 24)}…` : t
    }
    case 'box':
      return `Caixa ${formatMm(el.widthMm)} × ${formatMm(el.heightMm)}`
    case 'qr':
      return 'QR code'
    case 'field': {
      const names = el.columns.length > 0 ? el.columns : el.autos.map((a) => LABEL_FIELD_NAMES[a])
      const label = names.join(' + ')
      return label !== '' ? label : 'Campo vazio'
    }
  }
}
