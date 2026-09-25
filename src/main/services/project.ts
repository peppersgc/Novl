import { app, dialog } from 'electron'
import { join, basename, parse } from 'path'
import { mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync, existsSync, statSync, renameSync } from 'fs'
import {
  ProjectMeta,
  Category,
  CATEGORIES,
  Chapter,
  OpenDoc,
  AIConfigFile,
  ModelInfo
} from '../../shared/types'
import type { ReferenceDoc } from '../ai/prompts'

const DEFAULT_CONFIG: AIConfigFile = {
  modelPath: null,
  loadedModelName: null,
  temperature: 0.7,
  maxTokens: 1024
}

function configPath(): string {
  return join(app.getPath('userData'), 'ai-config.json')
}

function promptsOverridesPath(): string {
  return join(app.getPath('userData'), 'prompts-override.json')
}

function modelsDir(): string {
  const dir = join(app.getPath('userData'), 'models')
  mkdirSync(dir, { recursive: true })
  return dir
}

function lastProjectPath(): string {
  return join(app.getPath('userData'), 'last-project.json')
}

function safeFileName(name: string): string {
  const n = basename(name).replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
  return n || 'untitled'
}

let activeProject: string | null = null

export function projectDir(): string | null {
  return activeProject
}

export class ProjectService {
  private dir: string | null = null
  private meta: ProjectMeta | null = null

  async loadLast(): Promise<ProjectMeta | null> {
    try {
      const raw = readFileSync(lastProjectPath(), 'utf-8')
      const { path } = JSON.parse(raw) as { path: string }
      if (path && existsSync(join(path, 'project.json'))) {
        return this.openByPath(path)
      }
    } catch {
      /* no last project */
    }
    return null
  }

  private remember(path: string): void {
    writeFileSync(lastProjectPath(), JSON.stringify({ path }), 'utf-8')
  }

  private async createFiles(path: string): Promise<ProjectMeta> {
    mkdirSync(join(path, 'manuscript'), { recursive: true })
    for (const cat of CATEGORIES) {
      if (cat.file && !existsSync(join(path, cat.file))) {
        writeFileSync(join(path, cat.file), '', 'utf-8')
      }
    }
    const meta: ProjectMeta = { name: basename(path), author: '', updatedAt: Date.now() }
    writeFileSync(join(path, 'project.json'), JSON.stringify(meta, null, 2), 'utf-8')
    return meta
  }

  private handleProjectPath(path: string): void {
    activeProject = path
    this.dir = path
    this.remember(path)
  }

  private openByPath(path: string): ProjectMeta {
    const meta = JSON.parse(readFileSync(join(path, 'project.json'), 'utf-8')) as ProjectMeta
    this.ensureCategoryFiles(path)
    this.handleProjectPath(path)
    this.meta = meta
    return meta
  }

  private ensureCategoryFiles(path: string): void {
    const legacyMoves: Record<string, string> = { 'premise-theme.md': 'premise.md' }
    for (const cat of CATEGORIES) {
      if (!cat.file) continue
      const target = join(path, cat.file)
      if (existsSync(target)) continue
      const legacy = legacyMoves[cat.file]
      if (legacy && existsSync(join(path, legacy))) {
        renameSync(join(path, legacy), target)
      } else {
        writeFileSync(target, '', 'utf-8')
      }
    }
  }

  async pickNew(): Promise<ProjectMeta | null> {
    const res = await dialog.showSaveDialog({
      title: 'New project - pick a folder and name it',
      buttonLabel: 'Create project',
      defaultPath: join(app.getPath('documents'), 'My Novel'),
      properties: ['createDirectory', 'showOverwriteConfirmation']
    })
    if (res.canceled || !res.filePath) return null
    const path = res.filePath

    if (existsSync(path)) {
      if (existsSync(join(path, 'project.json'))) {
        return this.openByPath(path)
      }
      const children = readdirSync(path)
      if (children.length > 0) {
        await dialog.showMessageBox({
          type: 'warning',
          title: 'Not an empty folder',
          message: 'This folder already contains files.',
          detail:
            'A project needs its own folder. Pick an empty folder, or type a new project name so Novl can create it inside your chosen location.',
          buttons: ['OK']
        })
        return null
      }
    }

    mkdirSync(path, { recursive: true })
    const meta = await this.createFiles(path)
    this.handleProjectPath(path)
    this.meta = meta
    return meta
  }

  async pickOpen(): Promise<ProjectMeta | null> {
    const res = await dialog.showOpenDialog({
      title: 'Open Novl project',
      properties: ['openDirectory']
    })
    if (res.canceled || !res.filePaths[0]) return null
    return this.openByPath(res.filePaths[0])
  }

  info(): ProjectMeta | null {
    return this.meta
  }

  currentDir(): string | null {
    return this.dir
  }

  closeProject(): void {
    this.dir = null
    this.meta = null
    activeProject = null
    try {
      rmSync(lastProjectPath(), { force: true })
    } catch {
      /* ignore */
    }
  }

  // ---- documents ----

  categories(): Category[] {
    return CATEGORIES
  }

  private ensureProject(): string {
    const d = this.dir
    if (!d) throw new Error('No project is open')
    return d
  }

  private manuscriptDir(): string {
    return join(this.ensureProject(), 'manuscript')
  }

  chapters(): Chapter[] {
    const dir = this.manuscriptDir()
    mkdirSync(dir, { recursive: true })
    return readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith('.md'))
      .map((f) => ({ id: f, title: parse(f).name }))
      .sort((a, b) => {
        const na = Number.parseInt(a.title.replace(/[^0-9]+/g, ''))
        const nb = Number.parseInt(b.title.replace(/[^0-9]+/g, ''))
        if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb
        return a.title.localeCompare(b.title)
      })
  }

  private pathForKey(key: string): { file: string; kind: 'category' | 'chapter' } {
    if (key.startsWith('cat:')) {
      const id = key.slice(4)
      const cat = CATEGORIES.find((c) => c.id === id)
      if (!cat || !cat.file) throw new Error(`Unknown document: ${key}`)
      return { file: join(this.ensureProject(), cat.file), kind: 'category' }
    }
    if (key.startsWith('ch:')) {
      const file = safeFileName(key.slice(3))
      return { file: join(this.manuscriptDir(), file), kind: 'chapter' }
    }
    throw new Error(`Unknown document: ${key}`)
  }

  readDoc(key: string): OpenDoc {
    const { file, kind } = this.pathForKey(key)
    const content = existsSync(file) ? readFileSync(file, 'utf-8') : ''
    const title = this.titleForKey(key)
    return { key, title, content, kind }
  }

  async writeDoc(key: string, content: string): Promise<void> {
    const { file } = this.pathForKey(key)
    writeFileSync(file, content, 'utf-8')
    this.meta = { ...(this.meta ?? { name: 'Project', author: '', updatedAt: 0 }), updatedAt: Date.now() }
  }

  titleForKey(key: string): string {
    if (key.startsWith('cat:')) {
      const id = key.slice(4)
      return CATEGORIES.find((c) => c.id === id)?.label ?? key
    }
    if (key.startsWith('ch:')) return parse(safeFileName(key.slice(3))).name
    return key
  }

  createChapter(): Chapter {
    const dir = this.manuscriptDir()
    let n = 1
    const titles = new Set(this.chapters().map((c) => c.title))
    while (titles.has(`Chapter ${n}`)) n++
    const title = `Chapter ${n}`
    const file = `${title}.md`
    writeFileSync(join(dir, file), '', 'utf-8')
    return { id: file, title }
  }

  deleteChapter(id: string): void {
    const file = safeFileName(id)
    if (!file.toLowerCase().endsWith('.md')) throw new Error('Invalid chapter file')
    rmSync(join(this.manuscriptDir(), file), { force: true })
  }

  referenceDocs(excludeKey: string): ReferenceDoc[] {
    const out: ReferenceDoc[] = []
    const priority: string[] = [
      'outline',
      'continuity',
      'characters',
      'world',
      'premise-theme',
      'timeline',
      'notes'
    ]
    const cats = CATEGORIES.filter((c) => c.file && c.id !== 'manuscript')
    const byId = new Map<string, Category>(cats.map((c) => [c.id, c]))
    for (const id of priority) {
      const cat = byId.get(id)
      if (!cat || !cat.file) continue
      if (`cat:${id}` === excludeKey) continue
      const file = join(this.ensureProject(), cat.file)
      const content = existsSync(file) ? readFileSync(file, 'utf-8').trim() : ''
      if (content) out.push({ title: cat.label, content })
    }
    return out
  }

  // ---- AI config ----

  readConfig(): AIConfigFile {
    try {
      return { ...DEFAULT_CONFIG, ...(JSON.parse(readFileSync(configPath(), 'utf-8')) as AIConfigFile) }
    } catch {
      return { ...DEFAULT_CONFIG }
    }
  }

  writeConfig(patch: Partial<AIConfigFile>): AIConfigFile {
    const next = { ...this.readConfig(), ...patch }
    writeFileSync(configPath(), JSON.stringify(next, null, 2), 'utf-8')
    return next
  }

  // ---- prompt overrides (global, across all projects) ----

  readPromptOverrides(): Record<string, string> {
    try {
      return JSON.parse(readFileSync(promptsOverridesPath(), 'utf-8')) as Record<string, string>
    } catch {
      return {}
    }
  }

  savePromptOverride(id: string, text: string): string {
    const next = { ...this.readPromptOverrides(), [id]: text }
    writeFileSync(promptsOverridesPath(), JSON.stringify(next, null, 2), 'utf-8')
    return text
  }

  listModels(): ModelInfo[] {
    const dir = modelsDir()
    return readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith('.gguf'))
      .map((f) => {
        const p = join(dir, f)
        let size = 0
        try {
          size = statSync(p).size
        } catch {
          size = 0
        }
        return { path: p, name: parse(f).name, size }
      })
      .sort((a, b) => b.size - a.size)
  }
}