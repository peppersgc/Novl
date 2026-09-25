import { useRef, useEffect } from 'react'
import { Sparkles, Square, SlidersHorizontal } from 'lucide-react'
import { useStore } from '../store'
import { insertAtEnd } from '../lib/mark'
import { CONTINUITY_HEADING } from '../../../shared/types'

export function AiPrompt() {
  const activeDoc = useStore((s) => s.activeDoc)
  const config = useStore((s) => s.config)
  const aiBusy = useStore((s) => s.aiBusy)
  const modelStatus = useStore((s) => s.modelStatus)
  const modelName = useStore((s) => s.modelName)
  const refreshModelStatus = useStore((s) => s.refreshModelStatus)
  const prompt = useStore((s) => s.prompt)
  const setPrompt = useStore((s) => s.setPrompt)
  const setAiBusy = useStore((s) => s.setAiBusy)
  const setActiveContent = useStore((s) => s.setActiveContent)
  const setSettingsOpen = useStore((s) => s.setSettingsOpen)
  const showToast = useStore((s) => s.showToast)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef<{ id: string; text: string } | null>(null)
  const pendingRef = useRef<{ id: string; text: string } | null>(null)

  const promptId = activeDoc && (activeDoc.key.startsWith('ch:') ? 'chapter' : activeDoc.key)

  const flushPromptSave = (id: string, text: string): void => {
    if (
      lastSavedRef.current &&
      lastSavedRef.current.id === id &&
      lastSavedRef.current.text === text
    ) {
      return
    }
    void window.novl.prompts.save(id, text)
    lastSavedRef.current = { id, text }
  }

  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
        saveTimer.current = null
      }
      const pending = pendingRef.current
      if (pending) flushPromptSave(pending.id, pending.text)
    }
  }, [promptId])

  const onPromptChange = (value: string): void => {
    setPrompt(value)
    if (!promptId) return
    pendingRef.current = { id: promptId, text: value }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const pending = pendingRef.current
      if (pending) flushPromptSave(pending.id, pending.text)
      pendingRef.current = null
    }, 700)
  }

  const generate = async (): Promise<void> => {
    if (!activeDoc || aiBusy) return
    const instruction = prompt.trim()
    if (!instruction) {
      showToast('Type an instruction for the AI first', 'err')
      return
    }
    if (!config?.modelPath) {
      showToast('No model selected - open AI settings', 'err')
      return
    }
    if (modelStatus === 'loading') {
      showToast('The model is still loading...', 'err')
      return
    }
    if (promptId) {
      const pending = pendingRef.current
      if (pending) flushPromptSave(pending.id, pending.text)
    }
    setAiBusy(true)
    try {
      const text = await window.novl.ai.generate(
        instruction,
        activeDoc.key,
        activeDoc.title,
        activeDoc.content
      )
      void refreshModelStatus()
      if (text.trim()) {
        let chapterText = text
        let continuityBlock = ''
        if (activeDoc.key.startsWith('ch:')) {
          const lower = text.toLowerCase()
          let idx = lower.indexOf(CONTINUITY_HEADING.toLowerCase())
          if (idx === -1) idx = lower.indexOf('# continuity notes')
          if (idx === -1) idx = lower.indexOf('## continuity')
          if (idx !== -1) {
            chapterText = text.slice(0, idx).trim()
            continuityBlock = text.slice(idx).trim()
          }
        }
        if (chapterText) {
          const next = insertAtEnd(activeDoc.content, chapterText)
          setActiveContent(next)
          await window.novl.docs.write(activeDoc.key, next)
        }
        if (continuityBlock) {
          const cont = await window.novl.docs.read('cat:continuity')
          const next = insertAtEnd(cont.content, continuityBlock)
          await window.novl.docs.write('cat:continuity', next)
        }
        showToast(
          continuityBlock ? 'Generated - continuity notes updated' : 'Generated and appended'
        )
      } else {
        showToast('The model returned nothing', 'err')
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), 'err')
    } finally {
      setAiBusy(false)
    }
  }

  const stop = (): void => {
    void window.novl.ai.cancel()
  }

  const statusLabel =
    modelStatus === 'ready'
      ? `Model ready: ${modelName ?? 'unknown'}`
      : modelStatus === 'loading'
        ? 'Loading model...'
        : 'No model loaded'

  return (
    <section className="ai-prompt">
      <div className="ai-head">
        <span className="ai-target">
          Generating for: <strong>{activeDoc ? activeDoc.title : 'no document'}</strong>
        </span>
        <div className="ai-head-right">
          <button
            className={`gen-status ${aiBusy ? 'on' : 'off'}`}
            onClick={aiBusy ? stop : undefined}
            title={aiBusy ? 'Generation in progress - click to stop' : 'Generation idle'}
          >
            <span className="dot" />
            {aiBusy ? 'Generating…' : 'Idle'}
          </button>
          <button
            className={`ai-status ${modelStatus}`}
            onClick={() => setSettingsOpen(true)}
            title="Open AI settings"
          >
            <span className="dot" />
            {statusLabel}
          </button>
          <button className="btn ghost" onClick={() => setSettingsOpen(true)} title="AI settings">
            <SlidersHorizontal size={14} /> Settings
          </button>
        </div>
      </div>
      <div className="ai-body">
        <textarea
          ref={taRef}
          className="ai-input"
          placeholder={
            activeDoc
              ? 'Tell Novl what to write for this document... e.g. "Write the next scene, continue the dialogue."'
              : 'Open a document first'
          }
          value={prompt}
          disabled={!activeDoc}
          onChange={(e) => onPromptChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') void generate()
          }}
        />
        <div className="ai-actions">
          <button
            className="btn primary"
            disabled={aiBusy || !activeDoc}
            onClick={() => void generate()}
          >
            <Sparkles size={14} /> {aiBusy ? 'Generating…' : 'Generate'}
          </button>
          {aiBusy && (
            <button className="btn danger" onClick={stop}>
              <Square size={14} /> Stop
            </button>
          )}
        </div>
      </div>
    </section>
  )
}