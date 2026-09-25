import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron'
import { join, parse } from 'path'
import { statSync, rmSync, existsSync } from 'fs'
import { ProjectService } from './services/project'
import { llamaWorker } from './ai/engine'
import { buildGeneratePrompt } from './ai/prompts'
import { promptForDoc } from './ai/promptBank'

const project = new ProjectService()

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#16181d',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.once('ready-to-show', () => win.show())

  win.webContents.on('context-menu', (_e, params) => {
    const items: Electron.MenuItemConstructorOptions[] = []
    if (params.isEditable && params.misspelledWord) {
      if (params.dictionarySuggestions.length) {
        for (const suggestion of params.dictionarySuggestions) {
          items.push({
            label: suggestion,
            click: () => win.webContents.replaceMisspelling(suggestion)
          })
        }
      } else {
        items.push({ label: 'No spelling suggestions', enabled: false })
      }
      items.push({
        label: `Add "${params.misspelledWord}" to dictionary`,
        click: () =>
          void win.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord)
      })
      items.push({ type: 'separator' })
    }
    items.push({ role: 'undo', enabled: params.editFlags.canUndo })
    items.push({ role: 'redo', enabled: params.editFlags.canRedo })
    items.push({ type: 'separator' })
    items.push({ role: 'cut', enabled: params.editFlags.canCut })
    items.push({ role: 'copy', enabled: params.editFlags.canCopy })
    items.push({ role: 'paste', enabled: params.editFlags.canPaste })
    items.push({ type: 'separator' })
    items.push({ role: 'selectAll', enabled: params.editFlags.canSelectAll })
    const menu = Menu.buildFromTemplate(items)
    menu.popup({ window: win })
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return win
}

function registerIpc(): void {
  ipcMain.handle('project:create', () => project.pickNew())
  ipcMain.handle('project:open', () => project.pickOpen())
  ipcMain.handle('project:info', () => project.info())
  ipcMain.handle('project:close', () => {
    project.closeProject()
    return true
  })
  ipcMain.handle('project:delete', deleteActiveProject)

  ipcMain.handle('docs:categories', () => project.categories())
  ipcMain.handle('docs:chapters', () => project.chapters())
  ipcMain.handle('docs:read', (_e, key: string) => project.readDoc(key))
  ipcMain.handle('docs:write', (_e, key: string, content: string) => project.writeDoc(key, content))
  ipcMain.handle('docs:createChapter', () => project.createChapter())
  ipcMain.handle('docs:deleteChapter', (_e, id: string) => project.deleteChapter(id))
  ipcMain.handle('prompts:get', (_e, key: string, title: string) => {
    const id = key.startsWith('ch:') ? 'chapter' : key
    const saved = project.readPromptOverrides()[id]
    if (saved) return saved
    const isFirst = key.startsWith('ch:') && project.chapters()[0]?.title === title
    return promptForDoc({ key, title, isFirstChapter: isFirst })
  })
  ipcMain.handle('prompts:save', (_e, id: string, text: string) =>
    project.savePromptOverride(id, text)
  )

  ipcMain.handle('ai:config', () => project.readConfig())
  ipcMain.handle('ai:saveConfig', (_e, patch: Partial<import('../shared/types').AIConfigFile>) =>
    project.writeConfig(patch)
  )
  ipcMain.handle('ai:listModels', () => project.listModels())
  ipcMain.handle('ai:pickModel', pickModelFile)
  ipcMain.handle('ai:load', async () => {
    const cfg = project.readConfig()
    if (!cfg.modelPath) return null
    try {
      const { name } = await llamaWorker.load(cfg.modelPath)
      await project.writeConfig({ loadedModelName: name })
      return name
    } catch {
      return null
    }
  })
  ipcMain.handle('ai:loaded', () => llamaWorker.loadedModel())
  ipcMain.handle('ai:cancel', () => currentAbort?.abort() ?? false)
  ipcMain.handle(
    'ai:generate',
    async (_e, userPrompt: string, docKey: string, docTitle: string, docContent: string) => {
      const cfg = project.readConfig()
      if (!cfg.modelPath) throw new Error('No model selected')
      const { system, user } = buildGeneratePrompt(
        project.info()?.name ?? 'Untitled',
        docTitle,
        docContent,
        userPrompt,
        project.referenceDocs(docKey)
      )
      const ac = new AbortController()
      currentAbort = ac
      try {
        return await llamaWorker.generate(
          cfg.modelPath,
          {
            prompt: user,
            systemPrompt: system,
            maxTokens: cfg.maxTokens,
            temperature: cfg.temperature,
            topP: 0.95
          },
          ac.signal
        )
      } finally {
        if (currentAbort === ac) currentAbort = null
      }
    }
  )
}

let currentAbort: AbortController | null = null

async function deleteActiveProject(): Promise<boolean> {
  const dir = project.currentDir()
  if (!dir) return false
  if (!existsSync(join(dir, 'project.json'))) return false
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const opts = {
    type: 'warning' as const,
    title: 'Delete project',
    message: `Delete "${parse(dir).name}"?`,
    detail: `This permanently deletes the project folder and everything in it:\n${dir}`,
    buttons: ['Delete project', 'Cancel'],
    defaultId: 1,
    cancelId: 1
  }
  const { response } = win
    ? await dialog.showMessageBox(win, opts)
    : await dialog.showMessageBox(opts)
  if (response !== 0) return false
  try {
    rmSync(dir, { recursive: true, force: true })
  } catch {
    return false
  }
  project.closeProject()
  return true
}

async function pickModelFile(): Promise<import('../shared/types').ModelInfo | null> {
  const res = await dialog.showOpenDialog({
    title: 'Select a GGUF model',
    properties: ['openFile'],
    filters: [{ name: 'GGUF models', extensions: ['gguf'] }]
  })
  if (res.canceled || !res.filePaths[0]) return null
  const p = res.filePaths[0]
  let size = 0
  try {
    size = statSync(p).size
  } catch {
    size = 0
  }
  return { path: p, name: parse(p).name, size }
}

app.whenReady().then(async () => {
  registerIpc()
  buildMenu()
  createWindow()
  const last = await project.loadLast()
  // renderer picks it up via project:info; no extra window needed
  void last
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

function buildMenu(): void {
  const openSettings = (): void => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    win?.webContents.send('menu:open-settings')
  }
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: openSettings },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  void llamaWorker.dispose()
})