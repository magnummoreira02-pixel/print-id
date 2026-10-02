import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import type { AppSettings, LabelTemplate } from '../shared/types'
import { migrateV1Template, normalizeLibrary } from '../shared/labelTemplate'

function defaults(): AppSettings {
  const lib = normalizeLibrary(null, null)
  return {
    printerName: null,
    scanColumn: null,
    copies: 1,
    templates: lib.templates,
    activeTemplateId: lib.activeTemplateId
  }
}

export class SettingsManager {
  private filePath: string
  private settings: AppSettings

  constructor(dataDir: string) {
    this.filePath = join(dataDir, 'settings.json')
    this.settings = defaults()
    if (existsSync(this.filePath)) {
      try {
        const parsed = JSON.parse(readFileSync(this.filePath, 'utf-8')) as Record<string, unknown>
        this.settings = {
          ...defaults(),
          printerName: typeof parsed.printerName === 'string' ? parsed.printerName : null,
          scanColumn: typeof parsed.scanColumn === 'string' ? parsed.scanColumn : null,
          copies:
            typeof parsed.copies === 'number' && Number.isFinite(parsed.copies)
              ? Math.max(1, Math.min(10, parsed.copies))
              : 1
        }
        if (Array.isArray(parsed.templates)) {
          const lib = normalizeLibrary(parsed.templates, parsed.activeTemplateId)
          this.settings.templates = lib.templates
          this.settings.activeTemplateId = lib.activeTemplateId
        } else if ('labelTemplate' in parsed || 'labelWidthMm' in parsed) {
          // settings v1 (esqueleto fixo): converte preservando os ajustes
          const migrated = migrateV1Template(
            parsed.labelTemplate,
            typeof parsed.labelWidthMm === 'number' ? parsed.labelWidthMm : 50,
            typeof parsed.labelHeightMm === 'number' ? parsed.labelHeightMm : 25
          )
          this.settings.templates = [migrated]
          this.settings.activeTemplateId = migrated.id
          this.persist()
        }
      } catch (error) {
        console.error('settings.json inválido, usando padrões:', error)
      }
    }
  }

  private persist(): void {
    writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2), 'utf-8')
  }

  get(): AppSettings {
    return structuredClone(this.settings)
  }

  getActiveTemplate(): LabelTemplate {
    const active = this.settings.templates.find((t) => t.id === this.settings.activeTemplateId)
    return structuredClone(active ?? this.settings.templates[0])
  }

  set(patch: Partial<AppSettings>): AppSettings {
    this.settings = { ...this.settings, ...patch }
    if (patch.templates !== undefined || patch.activeTemplateId !== undefined) {
      const lib = normalizeLibrary(this.settings.templates, this.settings.activeTemplateId)
      this.settings.templates = lib.templates
      this.settings.activeTemplateId = lib.activeTemplateId
    }
    this.persist()
    return this.get()
  }
}
