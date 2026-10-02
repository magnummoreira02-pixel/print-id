import type { CSSProperties } from 'vue'
import type { LabelElement, LabelField, LabelFieldElement, RowData } from '@shared/types'

/**
 * ESPELHO da receita de renderização de `src/main/labels.ts` (LABEL_MAP,
 * resolveField, fieldValue, qrValue e elementStyle). O editor NÃO importa do
 * main; qualquer mudança lá precisa ser replicada aqui (e vice-versa) para
 * manter o canvas WYSIWYG em relação à impressão.
 */
export const LABEL_MAP: Record<LabelField, { exact: string; pattern: RegExp }> = {
  boxB: { exact: 'Range', pattern: /^range\b/i },
  boxL: { exact: 'Row', pattern: /^row\b/i },
  serpentine: { exact: 'Serpentine 25-26', pattern: /^serpentine\b/i },
  trait: { exact: 'Trait/Herbicide', pattern: /^trait\b/i },
  entryPrefix: { exact: 'Entry Prefix', pattern: /^entry\s*prefix\b/i },
  entrySuffix: { exact: 'Entry Suffix', pattern: /^entry\s*suffix\b/i },
  boxLetter: { exact: 'Box Letter', pattern: /^box\s*letter\b/i },
  id: { exact: 'ID 25-25', pattern: /^id\b/i },
  seedPac: { exact: 'SEED/PAC', pattern: /^seed\b/i },
  quadra: { exact: 'QUADRA', pattern: /^quadra\b/i },
  local: { exact: 'LOCAL', pattern: /^local\b/i }
}

/** Resolve um campo semântico para uma coluna existente na matriz */
export function resolveField(headers: string[], field: LabelField): string | null {
  const { exact, pattern } = LABEL_MAP[field]
  return headers.find((h) => h === exact) ?? headers.find((h) => pattern.test(h.trim())) ?? null
}

function cellText(data: RowData, column: string | null): string {
  if (!column) return ''
  const v = data[column]
  return v === null || v === undefined ? '' : String(v)
}

/** Valor impresso de um elemento de campo (prefixo + colunas concatenadas) */
export function fieldValue(el: LabelFieldElement, data: RowData, headers: string[]): string {
  const columns = el.columns.length > 0 ? el.columns : el.autos.map((a) => resolveField(headers, a))
  const parts = columns.map((c) => cellText(data, c)).filter((p) => p !== '')
  return el.prefix + parts.join(el.separator)
}

/** Conteúdo do QR (colunas configuradas ou a coluna do ID) */
export function qrValue(
  columns: string[],
  separator: string,
  data: RowData,
  headers: string[]
): string {
  if (columns.length > 0) {
    const parts = columns.map((c) => cellText(data, c)).filter((p) => p !== '')
    if (parts.length > 0) return parts.join(separator || ';')
  }
  return cellText(data, resolveField(headers, 'id')) || '-'
}

const mm = (v: number): string => `${v.toFixed(3)}mm`

/**
 * Estilo de um elemento — mesma receita do main, como objeto de estilo Vue.
 * A etiqueta impressa usa `* { box-sizing: border-box }`, igual ao preflight
 * do Tailwind no editor.
 */
export function elementStyle(el: LabelElement): CSSProperties {
  const s: CSSProperties = {
    position: 'absolute',
    left: mm(el.x),
    top: mm(el.y)
  }
  if (el.type === 'box') {
    s.width = mm(el.widthMm)
    s.height = mm(el.heightMm)
    s.border = `${mm(el.borderMm)} solid #000`
    return s
  }
  if (el.type === 'qr') {
    s.width = mm(el.sizeMm)
    s.height = mm(el.sizeMm)
    return s
  }
  // field | text
  s.fontSize = mm(el.fontSizeMm)
  s.fontWeight = el.bold ? 'bold' : 'normal'
  s.lineHeight = '1.1'
  s.whiteSpace = 'pre'
  if (el.rotation === 90) s.writingMode = 'vertical-rl'
  if (el.rotation === 270) s.writingMode = 'sideways-lr'
  if (el.type === 'field') {
    if (el.boxed) {
      s.border = `${mm(el.borderMm)} solid #000`
      if (el.widthMm === null && el.heightMm === null) s.padding = `${mm(0.2)} ${mm(1.1)}`
    }
    if (el.widthMm !== null) s.width = mm(el.widthMm)
    if (el.heightMm !== null) {
      s.height = mm(el.heightMm)
      s.display = 'flex'
      s.alignItems = 'center'
      s.justifyContent =
        el.align === 'left' ? 'flex-start' : el.align === 'right' ? 'flex-end' : 'center'
    } else if (el.widthMm !== null) {
      s.textAlign = el.align
    }
  }
  return s
}

/** Linha de amostra fixa (colunas de referência), usada sem matriz carregada */
export function sampleData(): RowData {
  return {
    [LABEL_MAP.boxB.exact]: 75,
    [LABEL_MAP.boxL.exact]: 80,
    [LABEL_MAP.serpentine.exact]: 58578,
    [LABEL_MAP.trait.exact]: 'PWM',
    [LABEL_MAP.entryPrefix.exact]: 12690,
    [LABEL_MAP.entrySuffix.exact]: 18,
    [LABEL_MAP.boxLetter.exact]: 'A',
    [LABEL_MAP.id.exact]: 6000,
    [LABEL_MAP.seedPac.exact]: 190,
    [LABEL_MAP.quadra.exact]: 8,
    [LABEL_MAP.local.exact]: 'BRE'
  }
}

export function sampleHeaders(): string[] {
  return Object.values(LABEL_MAP).map((m) => m.exact)
}
