import { ElectronAPI } from '@electron-toolkit/preload'
import type { BitredApi } from '../shared/api'

declare global {
  interface Window {
    electron: ElectronAPI
    api: BitredApi
  }
}
