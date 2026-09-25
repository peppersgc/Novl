export const SENT_SPLIT = /(?<=[.!?])\s+|\n+/g
export const MIN_LEN = 24
export const MAX_RANK = 400
export const DAMPING = 0.85
export const MAX_ITERS = 100
export const TOL = 1e-6

export const STOPWORDS = new Set(
  "the a an and or but if then else of to in on at for with from by as is are was were be been being this that these those it its i you we they he she them us our your their not no do does did so than too very can will just into out up down over about which who whom what when where why how all any each more most other some such only own same s t don now i'll i've it's we'll let me here there".split(
    " "
  )
)

export function splitSentences(text: string): string[] {
  const out: string[] = []
  for (const raw of (text || '').split(SENT_SPLIT)) {
    const s = raw.split(/\s+/).join(' ')
    if (s.length >= MIN_LEN) out.push(s)
  }
  return out
}

function tokenize(sentence: string): string[] {
  const lower = sentence.toLowerCase()
  const out: string[] = []
  for (const match of lower.matchAll(/[a-zA-Z][a-zA-Z']+/g)) {
    const w = match[0]
    if (w.length > 2 && !STOPWORDS.has(w)) out.push(w)
  }
  return out
}

function idf(tokens: string[][]): Map<string, number> {
  const n = tokens.length
  const df = new Map<string, number>()
  for (const toks of tokens) {
    for (const w of new Set(toks)) df.set(w, (df.get(w) ?? 0) + 1)
  }
  const out = new Map<string, number>()
  for (const [w, d] of df) out.set(w, Math.log((1 + n) / (1 + d)) + 1)
  return out
}

function tfidfSparse(tokens: string[][], idf: Map<string, number>): Map<string, number>[] {
  return tokens.map((toks) => {
    if (!toks.length) return new Map()
    const tf = new Map<string, number>()
    for (const w of toks) tf.set(w, (tf.get(w) ?? 0) + 1)
    const length = toks.length
    const vec = new Map<string, number>()
    for (const [w, c] of tf) vec.set(w, (c / length) * (idf.get(w) ?? 0))
    let norm = 0
    for (const v of vec.values()) norm += v * v
    norm = Math.sqrt(norm) || 1.0
    for (const [w, v] of vec) vec.set(w, v / norm)
    return vec
  })
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  if (a.size > b.size) {
    const t = a
    a = b
    b = t
  }
  let s = 0
  for (const [w, v] of a) {
    const w2 = b.get(w)
    if (w2) s += v * w2
  }
  return s
}

export function textrank(tokens: string[][], idf: Map<string, number>): number[] {
  const vecs = tfidfSparse(tokens, idf)
  const n = vecs.length
  const sim: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const c = cosine(vecs[i], vecs[j])
      if (c) {
        sim[i][j] = c
        sim[j][i] = c
      }
    }
  }
  const rowSum = sim.map((row) => row.reduce((a, b) => a + b, 0))

  let scores: number[] = new Array<number>(n).fill(1 / n)
  const base = (1 - DAMPING) / n
  for (let iter = 0; iter < MAX_ITERS; iter++) {
    const next = new Array<number>(n).fill(base)
    for (let i = 0; i < n; i++) {
      if (rowSum[i] === 0) continue
      const share = (DAMPING * scores[i]) / rowSum[i]
      const row = sim[i]
      for (let j = 0; j < n; j++) {
        const w = row[j]
        if (w) next[j] += share * w
      }
    }
    let diff = 0
    for (let i = 0; i < n; i++) diff += Math.abs(next[i] - scores[i])
    scores = next
    if (diff < TOL) break
  }
  return scores
}

function select(sentences: string[], scores: number[], k: number): string[] {
  const order = sentences
    .map((_, i) => i)
    .sort((a, b) => {
      const ra = Math.round(scores[a] * 1e10) / 1e10
      const rb = Math.round(scores[b] * 1e10) / 1e10
      if (ra !== rb) return rb - ra
      return a - b
    })
  return order
    .slice(0, k)
    .sort((a, b) => a - b)
    .map((i) => sentences[i])
}

export function summarize(text: string, k = 8): string[] {
  const sentences = splitSentences(text)
  if (sentences.length <= k) return sentences
  let s = sentences
  if (s.length > MAX_RANK) s = s.slice(-MAX_RANK)
  const tokens = s.map(tokenize)
  if (!tokens.some((t) => t.length)) return sentences.slice(0, k)
  const idfMap = idf(tokens)
  const scores = textrank(tokens, idfMap)
  return select(s, scores, k)
}