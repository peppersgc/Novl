export function applyWrap(
  el: HTMLTextAreaElement,
  before: string,
  after: string,
  placeholder = 'text'
): void {
  const s = el.selectionStart
  const e = el.selectionEnd
  const value = el.value
  const sel = value.slice(s, e) || placeholder
  const next = value.slice(0, s) + before + sel + after + value.slice(e)
  el.focus()
  setValueAndCaret(el, next, s + before.length, s + before.length + sel.length)
}

export function applyLinePrefix(el: HTMLTextAreaElement, prefix: string): void {
  const s = el.selectionStart
  const e = el.selectionEnd
  const value = el.value
  const lineStart = value.lastIndexOf('\n', s - 1) + 1
  let block = value.slice(lineStart, e)
  const hasPrefix = block
    .split('\n')
    .every((l) => l.startsWith(prefix) || l.trim().length === 0 || l.startsWith('#') || l.startsWith('-'))
  if (hasPrefix && block.includes(prefix)) {
    block = block
      .split('\n')
      .map((l) => (l.startsWith(prefix) ? l.slice(prefix.length) : l))
      .join('\n')
  } else {
    block = block
      .split('\n')
      .map((l) => (l.trim().length === 0 ? l : prefix + l))
      .join('\n')
  }
  const next = value.slice(0, lineStart) + block + value.slice(e)
  el.focus()
  setValueAndCaret(el, next, lineStart, lineStart + block.length)
}

function setValueAndCaret(
  el: HTMLTextAreaElement,
  value: string,
  caretStart: number,
  caretEnd: number
): void {
  const proto = Object.getPrototypeOf(el)
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  setter?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  requestAnimationFrame(() => {
    el.setSelectionRange(caretStart, caretEnd)
  })
}

export function insertAtEnd(content: string, generated: string): string {
  if (!generated.trim()) return content
  if (!content.trim()) return generated.trim()
  const sep = content.endsWith('\n') ? '' : '\n'
  return `${content}${sep}\n${generated.trim().replace(/\n{3,}/g, '\n\n')}`
}

export function wordCount(content: string): number {
  const m = content.trim().match(/\S+/g)
  return m ? m.length : 0
}

export function formatBytes(bytes: number): string {
  if (!bytes) return ''
  const gb = bytes / 1024 / 1024 / 1024
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  return `${Math.round(bytes / 1024 / 1024)} MB`
}