import { reactive } from 'vue'
import type { AppSettings } from '@shared/types'

interface SettingsState {
  settings: AppSettings | null
  loading: boolean
}

const state = reactive<SettingsState>({
  settings: null,
  loading: false
})

async function load(): Promise<AppSettings> {
  state.loading = true
  try {
    state.settings = await window.api.getSettings()
    return state.settings
  } finally {
    state.loading = false
  }
}

async function save(patch: Partial<AppSettings>): Promise<AppSettings> {
  state.settings = await window.api.setSettings(patch)
  return state.settings
}

export function useSettings(): {
  state: SettingsState
  load: typeof load
  save: typeof save
} {
  return { state, load, save }
}
