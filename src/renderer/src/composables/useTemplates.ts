import { computed, type ComputedRef } from 'vue'
import type { LabelTemplate, TemplateExportResult, TemplateImportResult } from '@shared/types'
import { factoryTemplate, newElementId } from '@shared/labelTemplate'
import { useSettings } from './useSettings'

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function uniqueName(base: string, existing: LabelTemplate[]): string {
  const names = new Set(existing.map((t) => t.name))
  if (!names.has(base)) return base
  let n = 2
  while (names.has(`${base} (${n})`)) n++
  return `${base} (${n})`
}

interface UseTemplates {
  templates: ComputedRef<LabelTemplate[]>
  activeId: ComputedRef<string | null>
  active: ComputedRef<LabelTemplate | null>
  byId: (id: string) => LabelTemplate | null
  setActive: (id: string) => Promise<void>
  upsert: (template: LabelTemplate) => Promise<void>
  create: () => Promise<LabelTemplate>
  duplicate: (id: string) => Promise<LabelTemplate | null>
  rename: (id: string, name: string) => Promise<void>
  remove: (id: string) => Promise<boolean>
  exportToFile: (id: string) => Promise<TemplateExportResult>
  importFromFile: () => Promise<TemplateImportResult & { added?: LabelTemplate }>
}

export function useTemplates(): UseTemplates {
  const { state, save } = useSettings()

  const templates = computed(() => state.settings?.templates ?? [])
  const activeId = computed(() => state.settings?.activeTemplateId ?? null)
  const active = computed(
    () => templates.value.find((t) => t.id === activeId.value) ?? templates.value[0] ?? null
  )

  function byId(id: string): LabelTemplate | null {
    return templates.value.find((t) => t.id === id) ?? null
  }

  async function persist(next: LabelTemplate[], nextActiveId?: string): Promise<void> {
    await save({
      templates: clone(next),
      activeTemplateId: nextActiveId ?? activeId.value ?? next[0]?.id ?? null
    })
  }

  async function setActive(id: string): Promise<void> {
    if (!byId(id)) return
    await save({ activeTemplateId: id })
  }

  async function upsert(template: LabelTemplate): Promise<void> {
    const list = clone(templates.value)
    const idx = list.findIndex((t) => t.id === template.id)
    if (idx >= 0) list[idx] = clone(template)
    else list.push(clone(template))
    await persist(list)
  }

  async function create(): Promise<LabelTemplate> {
    const template = factoryTemplate()
    template.id = newElementId()
    template.name = uniqueName('Nova etiqueta', templates.value)
    await persist([...clone(templates.value), template])
    return template
  }

  async function duplicate(id: string): Promise<LabelTemplate | null> {
    const source = byId(id)
    if (!source) return null
    const copy = clone(source)
    copy.id = newElementId()
    copy.name = uniqueName(`${source.name} — cópia`, templates.value)
    await persist([...clone(templates.value), copy])
    return copy
  }

  async function rename(id: string, name: string): Promise<void> {
    const list = clone(templates.value)
    const t = list.find((x) => x.id === id)
    if (!t) return
    t.name = name.trim().slice(0, 60) || t.name
    await persist(list)
  }

  async function remove(id: string): Promise<boolean> {
    if (templates.value.length <= 1) return false
    const list = clone(templates.value).filter((t) => t.id !== id)
    const nextActive = activeId.value === id ? list[0].id : undefined
    await persist(list, nextActive)
    return true
  }

  async function exportToFile(id: string): Promise<TemplateExportResult> {
    return window.api.exportTemplate(id)
  }

  async function importFromFile(): Promise<TemplateImportResult & { added?: LabelTemplate }> {
    const result = await window.api.importTemplate()
    if (!result.ok || !result.template) return result
    const added = clone(result.template)
    added.id = newElementId()
    added.name = uniqueName(added.name, templates.value)
    await persist([...clone(templates.value), added])
    return { ...result, added }
  }

  return {
    templates,
    activeId,
    active,
    byId,
    setActive,
    upsert,
    create,
    duplicate,
    rename,
    remove,
    exportToFile,
    importFromFile
  }
}
