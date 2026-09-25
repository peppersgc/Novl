import { useEffect } from 'react'
import { useStore } from './store'
import { Welcome } from './components/Welcome'
import { Rail } from './components/Rail'
import { AiPrompt } from './components/AiPrompt'
import { Editor } from './components/Editor'
import { ModelSettings } from './components/ModelSettings'
import { CheckCircle2, XCircle } from 'lucide-react'

export function App() {
  const meta = useStore((s) => s.meta)
  const toast = useStore((s) => s.toast)
  const init = useStore((s) => s.init)

  useEffect(() => {
    void init()
    return window.novl.menu.onOpenSettings(() => useStore.getState().setSettingsOpen(true))
  }, [])

  return (
    <div className="app">
      {!meta ? (
        <Welcome />
      ) : (
        <>
          <Rail />
          <main className="main">
            <AiPrompt />
            <Editor />
          </main>
        </>
      )}
      {toast && (
        <div className={`toast ${toast.kind}`}>
          {toast.kind === 'ok' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          {toast.message}
        </div>
      )}
      <ModelSettings />
    </div>
  )
}