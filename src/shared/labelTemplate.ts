import type {
  LabelAlign,
  LabelBoxElement,
  LabelElement,
  LabelField,
  LabelFieldElement,
  LabelQrElement,
  LabelRotation,
  LabelTemplate,
  LabelTextElement
} from './types'

export const LABEL_FIELD_NAMES: Record<LabelField, string> = {
  boxB: 'Caixa B (Range)',
  boxL: 'Caixa L (Row)',
  serpentine: 'Serpentine',
  trait: 'Trait/Herbicida',
  entryPrefix: 'Entry — prefixo',
  entrySuffix: 'Entry — sufixo',
  boxLetter: 'Letra da caixa',
  id: 'ID',
  seedPac: 'SEED/PAC',
  quadra: 'Quadra',
  local: 'Local'
}

export function newElementId(): string {
  return `el-${Math.random().toString(36).slice(2, 10)}`
}

function fieldEl(
  id: string,
  autos: LabelField[],
  pos: { x: number; y: number },
  fontSizeMm: number,
  extra: Partial<LabelFieldElement> = {}
): LabelFieldElement {
  return {
    id,
    type: 'field',
    x: pos.x,
    y: pos.y,
    visible: true,
    autos,
    columns: [],
    separator: ' - ',
    prefix: '',
    fontSizeMm,
    bold: true,
    align: 'left',
    rotation: 0,
    boxed: false,
    borderMm: 0.45,
    widthMm: null,
    heightMm: null,
    ...extra
  }
}

function textEl(
  id: string,
  text: string,
  pos: { x: number; y: number },
  fontSizeMm: number,
  extra: Partial<LabelTextElement> = {}
): LabelTextElement {
  return {
    id,
    type: 'text',
    x: pos.x,
    y: pos.y,
    visible: true,
    text,
    fontSizeMm,
    bold: true,
    align: 'left',
    rotation: 0,
    ...extra
  }
}

/**
 * Modelo de fábrica: réplica do modelo impresso (medidas extraídas do
 * modelo impressao.png em uma etiqueta de 50 × 25 mm).
 */
export function factoryTemplate(): LabelTemplate {
  return {
    id: 'factory-default',
    name: 'Modelo padrão',
    widthMm: 50,
    heightMm: 25,
    elements: [
      textEl('head-b', 'B', { x: 7.6, y: 1.4 }, 2.2),
      textEl('head-l', 'L', { x: 18.2, y: 1.4 }, 2.2),
      fieldEl('cell-b', ['boxB'], { x: 3, y: 3.6 }, 3.4, {
        boxed: true,
        widthMm: 10.8,
        heightMm: 4.4,
        align: 'center'
      }),
      fieldEl('cell-l', ['boxL'], { x: 13.35, y: 3.6 }, 3.4, {
        boxed: true,
        widthMm: 10.8,
        heightMm: 4.4,
        align: 'center'
      }),
      fieldEl('serpentine', ['serpentine'], { x: 1.8, y: 8.4 }, 3.8),
      fieldEl('trait', ['trait'], { x: 14.3, y: 8.6 }, 2.6, { boxed: true }),
      fieldEl('entry', ['entryPrefix', 'entrySuffix'], { x: 16, y: 13.8 }, 2.6),
      fieldEl('seed', ['seedPac'], { x: 1.8, y: 21 }, 2.3, {
        bold: false,
        boxed: true,
        borderMm: 0.25,
        widthMm: 8.9,
        heightMm: 2.9,
        align: 'center'
      }),
      fieldEl('box-letter', ['boxLetter'], { x: 16.4, y: 20.4 }, 3.6),
      textEl('id-prefix', 'ID-', { x: 32.4, y: 21.2 }, 2),
      fieldEl('id-value', ['id'], { x: 35.6, y: 20.6 }, 3),
      {
        id: 'qr',
        type: 'qr',
        x: 36.2,
        y: 2.4,
        visible: true,
        sizeMm: 9,
        columns: [],
        separator: ';'
      },
      fieldEl('quadra', ['quadra'], { x: 45.8, y: 2.6 }, 2.6, { prefix: 'Q-', rotation: 90 }),
      fieldEl('local', ['local'], { x: 0.3, y: 8 }, 1.9, { rotation: 270, visible: false })
    ]
  }
}

const VALID_FIELDS = new Set<string>(Object.keys(LABEL_FIELD_NAMES))
const VALID_ROTATIONS = new Set([0, 90, 270])
const VALID_ALIGNS = new Set(['left', 'center', 'right'])

function num(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback
  return Math.min(max, Math.max(min, n))
}

function str(v: unknown, fallback: string, maxLen = 200): string {
  return typeof v === 'string' ? v.slice(0, maxLen) : fallback
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((c): c is string => typeof c === 'string' && c !== '') : []
}

function normalizeElement(raw: unknown): LabelElement | null {
  if (typeof raw !== 'object' || raw === null) return null
  const e = raw as Record<string, unknown>
  const base = {
    id: str(e.id, newElementId(), 64) || newElementId(),
    x: num(e.x, 0, -50, 300),
    y: num(e.y, 0, -50, 300),
    visible: typeof e.visible === 'boolean' ? e.visible : true
  }
  const rotation = (VALID_ROTATIONS.has(e.rotation as number) ? e.rotation : 0) as LabelRotation
  const align = (VALID_ALIGNS.has(e.align as string) ? e.align : 'left') as LabelAlign

  switch (e.type) {
    case 'field': {
      const el: LabelFieldElement = {
        ...base,
        type: 'field',
        autos: strArray(e.autos).filter((f): f is LabelField => VALID_FIELDS.has(f)),
        columns: strArray(e.columns),
        separator: str(e.separator, ' - ', 8),
        prefix: str(e.prefix, '', 24),
        fontSizeMm: num(e.fontSizeMm, 2.6, 0.8, 20),
        bold: typeof e.bold === 'boolean' ? e.bold : true,
        align,
        rotation,
        boxed: typeof e.boxed === 'boolean' ? e.boxed : false,
        borderMm: num(e.borderMm, 0.45, 0.1, 2),
        widthMm: typeof e.widthMm === 'number' ? num(e.widthMm, 10, 1, 300) : null,
        heightMm: typeof e.heightMm === 'number' ? num(e.heightMm, 4, 1, 300) : null
      }
      return el
    }
    case 'text': {
      const el: LabelTextElement = {
        ...base,
        type: 'text',
        text: str(e.text, 'Texto', 120),
        fontSizeMm: num(e.fontSizeMm, 2.6, 0.8, 20),
        bold: typeof e.bold === 'boolean' ? e.bold : true,
        align,
        rotation
      }
      return el
    }
    case 'box': {
      const el: LabelBoxElement = {
        ...base,
        type: 'box',
        widthMm: num(e.widthMm, 10, 0.5, 300),
        heightMm: num(e.heightMm, 5, 0.5, 300),
        borderMm: num(e.borderMm, 0.45, 0.1, 2)
      }
      return el
    }
    case 'qr': {
      const el: LabelQrElement = {
        ...base,
        type: 'qr',
        sizeMm: num(e.sizeMm, 9, 3, 100),
        columns: strArray(e.columns),
        separator: str(e.separator, ';', 3)
      }
      return el
    }
    default:
      return null
  }
}

/** Valida/normaliza um elemento avulso (ex.: colado da área de transferência) */
export function normalizeLabelElement(raw: unknown): LabelElement | null {
  return normalizeElement(raw)
}

export function normalizeTemplate(raw: unknown): LabelTemplate | null {
  if (typeof raw !== 'object' || raw === null) return null
  const t = raw as Record<string, unknown>
  const elements = Array.isArray(t.elements)
    ? t.elements.map(normalizeElement).filter((e): e is LabelElement => e !== null)
    : []
  if (elements.length === 0) return null
  // ids duplicados (arquivo editado à mão) quebrariam seleção e :key
  const seenIds = new Set<string>()
  for (const el of elements) {
    if (seenIds.has(el.id)) el.id = newElementId()
    seenIds.add(el.id)
  }
  return {
    id: str(t.id, newElementId(), 64) || newElementId(),
    name: str(t.name, 'Sem nome', 60) || 'Sem nome',
    widthMm: num(t.widthMm, 50, 10, 300),
    heightMm: num(t.heightMm, 25, 5, 300),
    elements
  }
}

/**
 * Converte a configuração v1 (esqueleto fixo com slots) para um template v2,
 * preservando colunas mapeadas, visibilidade, escalas, rótulos e QR.
 */
export function migrateV1Template(v1: unknown, widthMm: number, heightMm: number): LabelTemplate {
  const template = factoryTemplate()
  template.widthMm = num(widthMm, 50, 10, 300)
  template.heightMm = num(heightMm, 25, 5, 300)
  if (typeof v1 !== 'object' || v1 === null) return template

  const cfg = v1 as {
    fields?: Record<string, { column?: unknown; visible?: unknown; scale?: unknown }>
    labels?: { boxB?: unknown; boxL?: unknown; idPrefix?: unknown }
    qrColumns?: unknown
    qrSeparator?: unknown
  }

  for (const el of template.elements) {
    if (el.type === 'field' && el.autos.length === 1) {
      const old = cfg.fields?.[el.autos[0]]
      if (old) {
        if (typeof old.column === 'string' && old.column !== '') el.columns = [old.column]
        if (typeof old.visible === 'boolean') el.visible = old.visible
        if (typeof old.scale === 'number' && Number.isFinite(old.scale)) {
          el.fontSizeMm = num(el.fontSizeMm * old.scale, el.fontSizeMm, 0.8, 20)
        }
      }
    }
    if (el.type === 'text' && el.id === 'head-b' && typeof cfg.labels?.boxB === 'string') {
      el.text = cfg.labels.boxB.slice(0, 6)
    }
    if (el.type === 'text' && el.id === 'head-l' && typeof cfg.labels?.boxL === 'string') {
      el.text = cfg.labels.boxL.slice(0, 6)
    }
    if (el.type === 'text' && el.id === 'id-prefix' && typeof cfg.labels?.idPrefix === 'string') {
      el.text = cfg.labels.idPrefix.slice(0, 8)
    }
    if (el.type === 'qr') {
      el.columns = strArray(cfg.qrColumns)
      el.separator = str(cfg.qrSeparator, ';', 3)
    }
  }

  // O elemento 'entry' tem dois autos e não entra no loop acima:
  // migra as configs v1 de entryPrefix/entrySuffix explicitamente
  const entry = template.elements.find((e) => e.id === 'entry')
  if (entry && entry.type === 'field') {
    const p = cfg.fields?.entryPrefix
    const s = cfg.fields?.entrySuffix
    const cols = [p?.column, s?.column].filter(
      (c): c is string => typeof c === 'string' && c !== ''
    )
    if (cols.length > 0) entry.columns = cols
    const pVisible = typeof p?.visible === 'boolean' ? p.visible : true
    const sVisible = typeof s?.visible === 'boolean' ? s.visible : true
    entry.visible = pVisible || sVisible
    if (typeof p?.scale === 'number' && Number.isFinite(p.scale)) {
      entry.fontSizeMm = num(entry.fontSizeMm * p.scale, entry.fontSizeMm, 0.8, 20)
    }
  }
  return template
}

/** Garante uma biblioteca válida: ao menos um template e um ativo existente */
export function normalizeLibrary(
  rawTemplates: unknown,
  rawActiveId: unknown
): { templates: LabelTemplate[]; activeTemplateId: string } {
  const templates = (Array.isArray(rawTemplates) ? rawTemplates : [])
    .map(normalizeTemplate)
    .filter((t): t is LabelTemplate => t !== null)
  if (templates.length === 0) templates.push(factoryTemplate())
  const active =
    typeof rawActiveId === 'string' && templates.some((t) => t.id === rawActiveId)
      ? rawActiveId
      : templates[0].id
  return { templates, activeTemplateId: active }
}
