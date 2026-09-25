import { useState } from 'react'
import {
  BookOpen,
  Plus,
  Trash2,
  FileText,
  FolderOpen,
  FolderPlus,
  Home,
  FolderKanban
} from 'lucide-react'
import { useStore } from '../store'
import type { Chapter } from '../../../shared/types'

export function Rail() {
  const meta = useStore((s) => s.meta)
  const categories = useStore((s) => s.categories)
  const chapters = useStore((s) => s.chapters)
  const activeDoc = useStore((s) => s.activeDoc)
  const openCategory = useStore((s) => s.openCategory)
  const openChapter = useStore((s) => s.openChapter)
  const addChapter = useStore((s) => s.addChapter)
  const delChapter = useStore((s) => s.delChapter)
  const init = useStore((s) => s.init)
  const closeProject = useStore((s) => s.closeProject)
  const deleteProject = useStore((s) => s.deleteProject)
  const showToast = useStore((s) => s.showToast)

  const [msExpanded, setMsExpanded] = useState(true)
  const [confirming, setConfirming] = useState<string | null>(null)

  const openProject = async (mode: 'open' | 'new'): Promise<void> => {
    const m = mode === 'open' ? await window.novl.project.open() : await window.novl.project.create()
    if (m) {
      await init()
      showToast(`Project "${m.name}" ${mode === 'open' ? 'opened' : 'created'}`)
    }
  }

  const onDelete = (ch: Chapter): void => {
    if (confirming === ch.id) {
      void delChapter(ch.id)
      setConfirming(null)
      showToast(`Deleted ${ch.title}`, 'ok')
    } else {
      setConfirming(ch.id)
      setTimeout(() => setConfirming((c) => (c === ch.id ? null : c)), 2500)
    }
  }

  return (
    <nav className="rail">
      <div className="rail-head">
        <div className="rail-title" title={meta?.author}>
          {meta?.name ?? 'Novl'}
        </div>
      </div>

      <button className="rail-switch" onClick={() => void closeProject()} title="Back to project selection">
        <Home size={14} /> Projects
      </button>
      <button className="rail-switch" onClick={() => void openProject('open')} title="Open another project">
        <FolderOpen size={14} /> Open
      </button>
      <button className="rail-switch" onClick={() => void openProject('new')} title="New project">
        <FolderPlus size={14} /> New
      </button>
      <button
        className="rail-switch danger"
        onClick={() => void deleteProject()}
        title="Delete this project permanently"
      >
        <FolderKanban size={14} /> Delete project
      </button>

      <div className="rail-scroll">
        {categories.map((cat) => {
          if (cat.id === 'manuscript') return null
          const key = `cat:${cat.id}`
          const active = activeDoc?.key === key
          return (
            <button
              key={cat.id}
              className={`rail-item${active ? ' active' : ''}`}
              onClick={() => void openCategory(cat.id)}
            >
              <BookOpen size={14} />
              {cat.label}
            </button>
          )
        })}

        <div className="ms-group">
          <div className="ms-row">
            <button
              className={`rail-item cat${msExpanded ? ' active' : ''}`}
              onClick={() => setMsExpanded((v) => !v)}
            >
              <BookOpen size={14} />
              Manuscript
            </button>
            <button className="icon-btn" title="Add chapter" onClick={() => void addChapter()}>
              <Plus size={14} />
            </button>
          </div>
          {msExpanded && (
            <div className="ms-chapters">
              {chapters.length === 0 && <div className="ms-empty">No chapters yet</div>}
              {chapters.map((ch) => {
                const key = `ch:${ch.id}`
                const active = activeDoc?.key === key
                return (
                  <div key={ch.id} className={`ms-chapter${active ? ' active' : ''}`}>
                    <button
                      className="ms-chapter-name"
                      onClick={() => void openChapter(ch)}
                      title={ch.title}
                    >
                      <FileText size={13} />
                      <span className="ms-ellipsis">{ch.title}</span>
                    </button>
                    <button
                      className={`row-del${confirming === ch.id ? ' confirm' : ''}`}
                      title={confirming === ch.id ? 'Click again to delete' : 'Delete chapter'}
                      onClick={() => onDelete(ch)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
