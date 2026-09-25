import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Bold,
  Italic,
  Underline,
  Heading2,
  List,
  Quote,
  AlignLeft,
  Save,
  Search,
  ChevronUp,
  ChevronDown,
  X
} from 'lucide-react'
import { useStore } from '../store'
import { applyWrap, applyLinePrefix, wordCount } from '../lib/mark'

function findAll(text: string, query: string): number[] {
  const q = query.toLowerCase()
  const lower = text.toLowerCase()
  const out: number[] = []
  let i = 0
  while (true) {
    const idx = lower.indexOf(q, i)
    if (idx === -1) break
    out.push(idx)
    i = idx + q.length
  }
  return out
}

export function Editor() {
  const activeDoc = useStore((s) => s.activeDoc)
  const setActiveContent = useStore((s) => s.setActiveContent)
  const showToast = useStore((s) => s.showToast)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const pendingRef = useRef<{ key: string; content: string } | null>(null)
  const findRef = useRef<HTMLInputElement>(null)
  const mirrorRef = useRef<HTMLDivElement>(null)
  const [savedSnapshot, setSavedSnapshot] = useState<{ key: string; content: string } | null>(null)
  const [findOpen, setFindOpen] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const [findIndex, setFindIndex] = useState(0)

  const markSaved = (key: string, content: string): void => {
    setSavedSnapshot({ key, content })
  }

  useEffect(() => {
    if (!activeDoc) return
    pendingRef.current = { key: activeDoc.key, content: activeDoc.content }
    const timer = setTimeout(() => {
      void window.novl.docs.write(activeDoc.key, activeDoc.content).then(() => {
        markSaved(activeDoc.key, activeDoc.content)
      })
    }, 900)
    return () => clearTimeout(timer)
  }, [activeDoc?.key, activeDoc?.content])

  useEffect(() => {
    if (activeDoc) markSaved(activeDoc.key, activeDoc.content)
  }, [activeDoc?.key])

  useEffect(() => {
    return () => {
      if (pendingRef.current) {
        void window.novl.docs.write(pendingRef.current.key, pendingRef.current.content)
        pendingRef.current = null
      }
    }
  }, [activeDoc?.key])

  useEffect(() => {
    setFindOpen(false)
    setFindQuery('')
    setFindIndex(0)
  }, [activeDoc?.key])

  useEffect(() => {
    if (findOpen) findRef.current?.focus()
  }, [findOpen])

  useEffect(() => {
    syncMirror()
    const ro = new ResizeObserver(() => syncMirror())
    if (taRef.current) ro.observe(taRef.current)
    return () => ro.disconnect()
  }, [activeDoc?.key, activeDoc?.content, findQuery, findOpen])

  const saveNow = async (): Promise<void> => {
    if (!activeDoc) return
    await window.novl.docs.write(activeDoc.key, activeDoc.content)
    markSaved(activeDoc.key, activeDoc.content)
    pendingRef.current = null
    showToast(`${activeDoc.title} saved`)
  }

  const syncMirror = (): void => {
    const ta = taRef.current
    const mi = mirrorRef.current
    if (!ta || !mi) return
    const sbw = ta.offsetWidth - ta.clientWidth
    const vScroll = ta.scrollHeight > ta.clientHeight ? sbw : 0
    mi.style.width = `${Math.max(160, ta.clientWidth - vScroll)}px`
    mi.scrollTop = ta.scrollTop
    mi.scrollLeft = ta.scrollLeft
  }

  if (!activeDoc) {
    return (
      <section className="editor">
        <div className="editor-empty">Pick a document on the left to start writing</div>
      </section>
    )
  }

  const dirty =
    !savedSnapshot ||
    savedSnapshot.key !== activeDoc.key ||
    savedSnapshot.content !== activeDoc.content

  const ta = (): HTMLTextAreaElement | null => taRef.current

  const wrap = (before: string, after: string): void => {
    const el = ta()
    if (el) applyWrap(el, before, after)
  }

  const line = (prefix: string): void => {
    const el = ta()
    if (el) applyLinePrefix(el, prefix)
  }

  const heading = (): void => {
    const el = ta()
    if (!el) return
    const lineStart = el.value.lastIndexOf('\n', el.selectionStart - 1) + 1
    const e = el.selectionEnd
    const block = el.value.slice(lineStart, e)
    void block
    applyLinePrefix(el, '## ')
  }

  const words = wordCount(activeDoc.content)
  const matches = findQuery ? findAll(activeDoc.content, findQuery) : []
  const safeIndex = matches.length ? Math.min(findIndex, matches.length - 1) : 0

  const scrollToCurrent = (start: number, len: number): void => {
    const ta = taRef.current
    if (ta) ta.setSelectionRange(start, start + len)
    requestAnimationFrame(() => {
      const cur = mirrorRef.current?.querySelector('mark.cur')
      const el = taRef.current
      if (!el || !cur) {
        syncMirror()
        return
      }
      const mr = cur.getBoundingClientRect()
      const tr = el.getBoundingClientRect()
      if (mr.top < tr.top - 2) el.scrollTop += mr.top - tr.top - 10
      else if (mr.bottom > tr.bottom - 2) el.scrollTop += mr.bottom - tr.bottom + 14
      syncMirror()
      el.setSelectionRange(start, start + len)
    })
  }

  const jumpTo = (n: number): void => {
    if (!matches.length) return
    const idx = ((n % matches.length) + matches.length) % matches.length
    setFindIndex(idx)
    scrollToCurrent(matches[idx], findQuery.length)
  }

  const onFindChange = (value: string): void => {
    setFindQuery(value)
    setFindIndex(0)
    if (value) {
      const ms = findAll(activeDoc.content, value)
      if (ms.length) scrollToCurrent(ms[0], value.length)
    }
  }

  const next = (): void => jumpTo(safeIndex + 1)
  const prev = (): void => jumpTo(safeIndex - 1)

  const highlighted: ReactNode | null = (() => {
    if (!findQuery || !matches.length) return null
    const ql = findQuery.length
    const parts: ReactNode[] = []
    let last = 0
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i]
      if (m > last) parts.push(activeDoc.content.slice(last, m))
      parts.push(
        <mark key={i} className={i === safeIndex ? 'cur' : ''}>
          {activeDoc.content.slice(m, m + ql)}
        </mark>
      )
      last = m + ql
    }
    if (last < activeDoc.content.length) parts.push(activeDoc.content.slice(last))
    return parts
  })()

  return (
    <section className="editor">
      <div className="editor-toolbar">
        <button className="tb" title="Bold" onClick={() => wrap('**', '**')}>
          <Bold size={15} />
        </button>
        <button className="tb" title="Italic" onClick={() => wrap('*', '*')}>
          <Italic size={15} />
        </button>
        <button className="tb" title="Underline" onClick={() => wrap('<u>', '</u>')}>
          <Underline size={15} />
        </button>
        <span className="tb-sep" />
        <button className="tb" title="Heading" onClick={heading}>
          <Heading2 size={15} />
        </button>
        <button className="tb" title="Bullet list" onClick={() => line('- ')}>
          <List size={15} />
        </button>
        <button className="tb" title="Quote" onClick={() => line('> ')}>
          <Quote size={15} />
        </button>
        <span className="tb-sep" />
        <button
          className={`tb${findOpen ? ' active' : ''}`}
          title="Find in this document (Ctrl+F)"
          onClick={() => setFindOpen((v) => !v)}
        >
          <Search size={15} />
        </button>
        <span className="tb-sep" />
        <button
          className={`tb save-btn${dirty ? ' dirty' : ''}`}
          title={dirty ? 'Save changes' : 'Everything is saved'}
          onClick={() => void saveNow()}
        >
          <Save size={15} />
        </button>
        <span className={`save-label${dirty ? ' dirty' : ''}`}>
          {dirty ? 'Unsaved changes' : 'Saved'}
        </span>
        <span className="tb-sep" />
        <span className="tb-label">
          <AlignLeft size={13} /> {words} words
        </span>
      </div>
      {findOpen && (
        <div className="find-bar">
          <input
            ref={findRef}
            className="find-input"
            placeholder="Find in this document"
            value={findQuery}
            onChange={(e) => onFindChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                e.shiftKey ? prev() : next()
              } else if (e.key === 'Escape') {
                setFindOpen(false)
              }
            }}
          />
          <span className="find-count">
            {findQuery ? `${matches.length ? safeIndex + 1 : 0} / ${matches.length}` : ''}
          </span>
          <button className="tb" title="Previous (Shift+Enter)" onClick={prev} disabled={!matches.length}>
            <ChevronUp size={15} />
          </button>
          <button className="tb" title="Next (Enter)" onClick={next} disabled={!matches.length}>
            <ChevronDown size={15} />
          </button>
          <button className="tb" title="Close (Esc)" onClick={() => setFindOpen(false)}>
            <X size={15} />
          </button>
        </div>
      )}
      <div className="editor-wrap">
        <div className="editor-surface editor-mirror" ref={mirrorRef} aria-hidden="true">
          {highlighted}
        </div>
        <textarea
          key={activeDoc.key}
          ref={taRef}
          className="editor-surface editor-text"
          value={activeDoc.content}
          onChange={(e) => setActiveContent(e.target.value)}
          onScroll={syncMirror}
          onKeyDown={(e) => {
            if (e.ctrlKey && e.key.toLowerCase() === 'f') {
              e.preventDefault()
              setFindOpen(true)
            }
          }}
          spellCheck
          dir="auto"
        />
      </div>
    </section>
  )
}