import { contextBridge, ipcRenderer } from 'electron'
import type {
  PreloadApi,
  ProjectMeta,
  Category,
  Chapter,
  OpenDoc,
  AIConfigFile,
  ModelInfo
} from '../shared/types'

const api: PreloadApi = {
  project: {
    create: () => ipcRenderer.invoke('project:create') as Promise<ProjectMeta | null>,
    open: () => ipcRenderer.invoke('project:open') as Promise<ProjectMeta | null>,
    info: () => ipcRenderer.invoke('project:info') as Promise<ProjectMeta | null>,
    close: () => ipcRenderer.invoke('project:close') as Promise<boolean>,
    delete: () => ipcRenderer.invoke('project:delete') as Promise<boolean>
  },
  docs: {
    categories: () => ipcRenderer.invoke('docs:categories') as Promise<Category[]>,
    chapters: () => ipcRenderer.invoke('docs:chapters') as Promise<Chapter[]>,
    read: (key: string) => ipcRenderer.invoke('docs:read', key) as Promise<OpenDoc>,
    write: (key: string, content: string) =>
      ipcRenderer.invoke('docs:write', key, content) as Promise<void>,
    createChapter: () => ipcRenderer.invoke('docs:createChapter') as Promise<Chapter>,
    deleteChapter: (id: string) => ipcRenderer.invoke('docs:deleteChapter', id) as Promise<void>
  },
  prompts: {
    get: (key: string, title: string) =>
      ipcRenderer.invoke('prompts:get', key, title) as Promise<string>,
    save: (id: string, text: string) =>
      ipcRenderer.invoke('prompts:save', id, text) as Promise<string>
  },
  ai: {
    config: () => ipcRenderer.invoke('ai:config') as Promise<AIConfigFile>,
    saveConfig: (patch: Partial<AIConfigFile>) =>
      ipcRenderer.invoke('ai:saveConfig', patch) as Promise<AIConfigFile>,
    listModels: () => ipcRenderer.invoke('ai:listModels') as Promise<ModelInfo[]>,
    pickModel: () => ipcRenderer.invoke('ai:pickModel') as Promise<ModelInfo | null>,
    load: () => ipcRenderer.invoke('ai:load') as Promise<string | null>,
    loaded: () => ipcRenderer.invoke('ai:loaded') as Promise<string | null>,
    generate: (userPrompt: string, docKey: string, docTitle: string, docContent: string) =>
      ipcRenderer.invoke(
        'ai:generate',
        userPrompt,
        docKey,
        docTitle,
        docContent
      ) as Promise<string>,
    cancel: () => ipcRenderer.invoke('ai:cancel') as Promise<boolean>
  },
  menu: {
    onOpenSettings: (cb: () => void) => {
      const listener = (): void => cb()
      ipcRenderer.on('menu:open-settings', listener)
      return () => ipcRenderer.removeListener('menu:open-settings', listener)
    }
  }
}

contextBridge.exposeInMainWorld('novl', api)