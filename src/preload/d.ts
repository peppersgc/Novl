import type { PreloadApi } from '../shared/types'

declare global {
  interface Window {
    novl: PreloadApi
  }
}

export {}