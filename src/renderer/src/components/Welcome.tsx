import { useStore } from '../store'

export function Welcome() {
  const init = useStore((s) => s.init)
  const showToast = useStore((s) => s.showToast)

  const create = async (): Promise<void> => {
    const meta = await window.novl.project.create()
    if (meta) {
      await init()
      showToast(`Project "${meta.name}" created`)
    }
  }

  const open = async (): Promise<void> => {
    const meta = await window.novl.project.open()
    if (meta) {
      await init()
      showToast(`Project "${meta.name}" opened`)
    }
  }

  return (
    <div className="welcome">
      <div className="welcome-card">
        <h1>Novl</h1>
        <p>Local-AI writing workspace. Your words stay on this machine.</p>
        <div className="welcome-actions">
          <button className="btn primary" onClick={() => void create()}>
            New project
          </button>
          <button className="btn" onClick={() => void open()}>
            Open project
          </button>
        </div>
      </div>
    </div>
  )
}
