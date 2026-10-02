import QRCode from 'qrcode'
import type {
  LabelElement,
  LabelField,
  LabelFieldElement,
  LabelTemplate,
  MatrixRow,
  RowData
} from '../shared/types'

/**
 * Colunas de referência dos campos semânticos (modelo impressao.png).
 * `exact` é o nome na matriz de referência; `pattern` tolera variações de
 * safra (ex.: "ID 25-25" → "ID 26-26").
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

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Valor impresso de um elemento de campo (prefixo + colunas concatenadas) */
export function fieldValue(el: LabelFieldElement, data: RowData, headers: string[]): string {
  const columns = el.columns.length > 0 ? el.columns : el.autos.map((a) => resolveField(headers, a))
  const parts = columns.map((c) => cellText(data, c)).filter((p) => p !== '')
  return el.prefix + parts.join(el.separator)
}

function qrValue(columns: string[], separator: string, data: RowData, headers: string[]): string {
  if (columns.length > 0) {
    const parts = columns.map((c) => cellText(data, c)).filter((p) => p !== '')
    if (parts.length > 0) return parts.join(separator || ';')
  }
  return cellText(data, resolveField(headers, 'id')) || '-'
}

const mm = (v: number): string => `${v.toFixed(3)}mm`

/**
 * Estilo de um elemento da etiqueta. ATENÇÃO: o editor visual
 * (renderer/views/etiqueta-editor) espelha exatamente esta receita — mudanças
 * aqui precisam ser replicadas lá para manter o WYSIWYG.
 */
export function elementStyle(el: LabelElement): string {
  const parts: string[] = [`position:absolute`, `left:${mm(el.x)}`, `top:${mm(el.y)}`]
  if (el.type === 'box') {
    parts.push(
      `width:${mm(el.widthMm)}`,
      `height:${mm(el.heightMm)}`,
      `border:${mm(el.borderMm)} solid #000`
    )
    return parts.join(';')
  }
  if (el.type === 'qr') {
    parts.push(`width:${mm(el.sizeMm)}`, `height:${mm(el.sizeMm)}`)
    return parts.join(';')
  }
  // field | text
  parts.push(
    `font-size:${mm(el.fontSizeMm)}`,
    `font-weight:${el.bold ? 'bold' : 'normal'}`,
    `line-height:1.1`,
    `white-space:pre`
  )
  if (el.rotation === 90) parts.push('writing-mode:vertical-rl')
  if (el.rotation === 270) parts.push('writing-mode:sideways-lr')
  if (el.type === 'field') {
    if (el.boxed) {
      parts.push(`border:${mm(el.borderMm)} solid #000`)
      if (el.widthMm === null && el.heightMm === null) parts.push(`padding:${mm(0.2)} ${mm(1.1)}`)
    }
    if (el.widthMm !== null) parts.push(`width:${mm(el.widthMm)}`)
    if (el.heightMm !== null) {
      parts.push(
        `height:${mm(el.heightMm)}`,
        'display:flex',
        'align-items:center',
        `justify-content:${el.align === 'left' ? 'flex-start' : el.align === 'right' ? 'flex-end' : 'center'}`
      )
    } else if (el.widthMm !== null) {
      parts.push(`text-align:${el.align}`)
    }
  }
  return parts.join(';')
}

async function labelBody(
  row: MatrixRow,
  template: LabelTemplate,
  headers: string[]
): Promise<string> {
  const pieces: string[] = []
  for (const el of template.elements) {
    if (!el.visible) continue
    const style = elementStyle(el)
    if (el.type === 'box') {
      pieces.push(`<div style="${style}"></div>`)
    } else if (el.type === 'qr') {
      const dataUrl = await QRCode.toDataURL(qrValue(el.columns, el.separator, row.data, headers), {
        margin: 0,
        errorCorrectionLevel: 'M',
        width: 256
      })
      pieces.push(
        `<div style="${style}"><img src="${dataUrl}" alt="" style="width:100%;height:100%;image-rendering:pixelated;display:block"></div>`
      )
    } else if (el.type === 'text') {
      pieces.push(`<div style="${style}">${esc(el.text)}</div>`)
    } else {
      pieces.push(`<div style="${style}">${esc(fieldValue(el, row.data, headers))}</div>`)
    }
  }
  return `<div class="label">${pieces.join('')}</div>`
}

export async function buildLabelsHtml(
  rows: MatrixRow[],
  template: LabelTemplate,
  headers: string[]
): Promise<string> {
  const bodies = await Promise.all(rows.map((r) => labelBody(r, template, headers)))
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: ${mm(template.widthMm)} ${mm(template.heightMm)}; margin: 0; }
  html, body { background: #fff; }
  .label {
    position: relative;
    width: ${mm(template.widthMm)};
    height: ${mm(template.heightMm)};
    overflow: hidden;
    font-family: Arial, Helvetica, sans-serif;
    color: #000;
    page-break-after: always;
    break-after: page;
  }
</style>
</head>
<body>
${bodies.join('\n')}
</body>
</html>`
}

export function sampleRow(): MatrixRow {
  return {
    id: 0,
    data: {
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
}

export function sampleHeaders(): string[] {
  return Object.values(LABEL_MAP).map((m) => m.exact)
}
