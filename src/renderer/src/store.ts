import { create } from 'zustand'
import type {
  ProjectMeta,
  Category,
  Chapter,
  OpenDoc,
  AIConfigFile,
  ModelInfo
} from '../../shared/types'

export interface Toast {
  message: string
  kind: 'ok' | 'err'
}

export type ModelStatus = 'none' | 'loading' | 'ready' | 'error'

interface Store {
  meta: ProjectMeta | null
  categories: Category[]
  chapters: Chapter[]
  activeDoc: OpenDoc | null
  config: AIConfigFile | null
  models: ModelInfo[]
  aiBusy: boolean
  modelStatus: ModelStatus
  modelName: string | null
  prompt: string
  toast: Toast | null
  showSettings: boolean

  init: () => Promise<void>
  initModel: () => Promise<void>
  refreshModelStatus: () => Promise<void>
  closeProject: () => Promise<void>
  deleteProject: () => Promise<void>
  openCategory: (id: string) => Promise<void>
  openChapter: (chapter: Chapter) => Promise<void>
  addChapter: () => Promise<void>
  delChapter: (id: string) => Promise<void>
  setActiveContent: (content: string) => void
  setConfig: (patch: Partial<AIConfigFile>) => Promise<void>
  refreshChapters: () => Promise<void>
  refreshModels: () => Promise<void>
  setAiBusy: (busy: boolean) => void
  setPrompt: (v: string) => void
  setSettingsOpen: (v: boolean) => void
  showToast: (message: string, kind?: Toast['kind']) => void
}

let toastTimer: ReturnType<typeof setTimeout> | null = null

export const useStore = create<Store>((set, get) => ({
  meta: null,
  categories: [],
  chapters: [],
  activeDoc: null,
  config: null,
  models: [],
  aiBusy: false,
  modelStatus: 'none',
  modelName: null,
  prompt: '',
  toast: null,
  showSettings: false,

  init: async () => {
    const [info, cats, cfg] = await Promise.all([
      window.novl.project.info(),
      window.novl.docs.categories(),
      window.novl.ai.config()
    ])
    set({ meta: info, categories: cats, config: cfg })
    void get().initModel()
    if (info) {
      const chapters = await window.novl.docs.chapters()
      set({ chapters })
      if (chapters.length) {
        await get().openChapter(chapters[0])
      } else {
        await get().openCategory('bible')
      }
    }
  },

  initModel: async () => {
    const cfg = get().config
    if (!cfg?.modelPath) {
      set({ modelStatus: 'none', modelName: null })
      return
    }
    set({ modelStatus: 'loading', modelName: null })
    try {
      const name = await window.novl.ai.load()
      if (name) {
        set({ modelStatus: 'ready', modelName: name })
      } else {
        set({ modelStatus: 'error', modelName: null })
        get().showToast('Failed to load the model', 'err')
      }
    } catch {
      set({ modelStatus: 'error', modelName: null })
      get().showToast('Failed to load the model', 'err')
    }
  },

  refreshModelStatus: async () => {
    try {
      const name = await window.novl.ai.loaded()
      if (name) set({ modelStatus: 'ready', modelName: name })
      else set({ modelStatus: 'none', modelName: null })
    } catch {
      set({ modelStatus: 'error', modelName: null })
    }
  },

  closeProject: async () => {
    await window.novl.project.close()
    set({ meta: null, chapters: [], activeDoc: null, prompt: '' })
  },

  deleteProject: async () => {
    const deleted = await window.novl.project.delete()
    if (deleted) {
      set({ meta: null, chapters: [], activeDoc: null, prompt: '' })
      get().showToast('Project deleted')
    }
  },

  openCategory: async (id: string) => {
    const doc = await window.novl.docs.read(`cat:${id}`)
    const promptText = await window.novl.prompts.get(doc.key, doc.title)
    set({ activeDoc: doc, prompt: promptText })
  },

  openChapter: async (chapter: Chapter) => {
    const doc = await window.novl.docs.read(`ch:${chapter.id}`)
    const promptText = await window.novl.prompts.get(doc.key, doc.title)
    set({ activeDoc: doc, prompt: promptText })
  },

  addChapter: async () => {
    const ch = await window.novl.docs.createChapter()
    await get().refreshChapters()
    await get().openChapter(ch)
  },

  delChapter: async (id: string) => {
    await window.novl.docs.deleteChapter(id)
    const chapters = await window.novl.docs.chapters()
    set({ chapters })
    const cur = get().activeDoc
    if (cur && cur.key === `ch:${id}`) {
      if (chapters.length) await get().openChapter(chapters[0])
      else await get().openCategory('bible')
    }
  },

  setActiveContent: (content: string) => {
    const doc = get().activeDoc
    if (doc) set({ activeDoc: { ...doc, content } })
  },

  setConfig: async (patch) => {
    const cfg = await window.novl.ai.saveConfig(patch)
    set({ config: cfg })
  },

  refreshChapters: async () => {
    if (get().meta) set({ chapters: await window.novl.docs.chapters() })
  },

  refreshModels: async () => {
    set({ models: await window.novl.ai.listModels() })
  },

  setAiBusy: (busy) => set({ aiBusy: busy }),
  setPrompt: (v) => set({ prompt: v }),
  setSettingsOpen: (v) => set({ showSettings: v }),

  showToast: (message, kind = 'ok') => {
    if (toastTimer) clearTimeout(toastTimer)
    set({ toast: { message, kind } })
    toastTimer = setTimeout(() => set({ toast: null }), 3500)
  }
}))