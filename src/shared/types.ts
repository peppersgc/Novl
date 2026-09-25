export interface ProjectMeta {
  name: string
  author: string
  updatedAt: number
}

export interface Chapter {
  id: string
  title: string
}

export type CategoryId =
  | 'premise-theme'
  | 'characters'
  | 'world'
  | 'timeline'
  | 'outline'
  | 'continuity'
  | 'notes'
  | 'manuscript'

export interface Category {
  id: CategoryId
  label: string
  file?: string
}

export const CATEGORIES: Category[] = [
  { id: 'premise-theme', label: 'Premise', file: 'premise-theme.md' },
  { id: 'characters', label: 'Characters', file: 'characters.md' },
  { id: 'world', label: 'World', file: 'world.md' },
  { id: 'timeline', label: 'Timeline', file: 'timeline.md' },
  { id: 'outline', label: 'Outline', file: 'outline.md' },
  { id: 'continuity', label: 'Continuity', file: 'continuity.md' },
  { id: 'notes', label: 'Notes', file: 'notes.md' },
  { id: 'manuscript', label: 'Manuscript' }
]

export const isChapterKey = (key: string): boolean => key.startsWith('ch:')

export const CONTINUITY_HEADING = '## Continuity Notes'

export interface OpenDoc {
  key: string
  title: string
  content: string
  kind: 'category' | 'chapter'
}

export interface AIConfigFile {
  modelPath: string | null
  loadedModelName: string | null
  temperature: number
  maxTokens: number
}

export interface ModelInfo {
  path: string
  name: string
  size: number
}

export interface PreloadApi {
  project: {
    create: () => Promise<ProjectMeta | null>
    open: () => Promise<ProjectMeta | null>
    info: () => Promise<ProjectMeta | null>
    close: () => Promise<boolean>
    delete: () => Promise<boolean>
  }
  docs: {
    categories: () => Promise<Category[]>
    chapters: () => Promise<Chapter[]>
    read: (key: string) => Promise<OpenDoc>
    write: (key: string, content: string) => Promise<void>
    createChapter: () => Promise<Chapter>
    deleteChapter: (id: string) => Promise<void>
  }
  prompts: {
    get: (key: string, title: string) => Promise<string>
    save: (id: string, text: string) => Promise<string>
  }
  ai: {
    config: () => Promise<AIConfigFile>
    saveConfig: (patch: Partial<AIConfigFile>) => Promise<AIConfigFile>
    listModels: () => Promise<ModelInfo[]>
    pickModel: () => Promise<ModelInfo | null>
    load: () => Promise<string | null>
    loaded: () => Promise<string | null>
    generate: (userPrompt: string, docKey: string, docTitle: string, docContent: string) =>
      Promise<string>
    cancel: () => Promise<boolean>
  }
  menu: {
    onOpenSettings: (cb: () => void) => () => void
  }
}