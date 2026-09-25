import { spawn, type ChildProcess } from 'child_process'
import { createServer, type AddressInfo } from 'net'
import { join, dirname } from 'path'
import { app } from 'electron'

export interface GenerationRequest {
  prompt: string
  systemPrompt: string
  maxTokens: number
  temperature: number
  topP: number
}

const START_TIMEOUT_MS = 240_000
const HEALTH_POLL_MS = 500
const LOG_TAIL_BYTES = 4000

function stripTags(l: string): string {
  return l.trim().toLowerCase().replace(/[<>]/g, '')
}

function cleanScaffold(text: string): string {
  const lines = text.split('\n')
  const first = lines.findIndex((l) => l.trim() !== '')
  if (first === -1) return text.trim()
  const open = stripTags(lines[first])
  if (open !== 'think' && open !== 'thinking') return text.trim()
  const end = lines.findIndex((l, idx) => {
    if (idx <= first) return false
    const t = stripTags(l)
    return t === '/think' || t === '/thinking' || t === 'response' || t === '/response'
  })
  if (end === -1) return text.trim()
  return lines.slice(end + 1).join('\n').replace(/^\s*\n/, '').trim()
}

function serverBinaryPath(): string {
  if (app.isPackaged) return join(process.resourcesPath, 'llama-server', 'llama-server.exe')
  return join(app.getAppPath(), 'backend', 'llama-server.exe')
}

function findFreePort(): Promise<number> {
  return new Promise((resolve) => {
    const srv = createServer()
    srv.unref()
    srv.on('error', () => resolve(18000 + Math.floor(Math.random() * 1000)))
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as AddressInfo).port
      srv.close(() => resolve(port))
    })
  })
}

export class LlamaServerClient {
  private proc: ChildProcess | null = null
  private currentModelPath: string | null = null
  private port = 0
  private booting: Promise<void> | null = null
  private intentionalExit = false
  private spawnError: string | null = null
  private logTail = ''
  private fullLog = ''

  private record(buf: string): void {
    this.logTail = (this.logTail + buf).slice(-LOG_TAIL_BYTES)
    this.fullLog = (this.fullLog + buf).slice(-200_000)
  }

  private serverPath(): string {
    return serverBinaryPath()
  }

  private killProc(): void {
    if (!this.proc) return
    this.intentionalExit = true
    try {
      this.proc.kill()
    } catch {
      /* ignore */
    }
    this.proc = null
    this.currentModelPath = null
    this.port = 0
  }

  private async healthyNow(): Promise<boolean> {
    if (!this.proc || !this.port) return false
    try {
      const res = await fetch(`http://127.0.0.1:${this.port}/health`, { signal: AbortSignal.timeout(1500) })
      if (res.ok) {
        const j = (await res.json()) as { status?: string }
        if (j.status === 'ok') return true
      }
    } catch {
      /* server not ready */
    }
    return false
  }

  private async waitHealthy(proc: ChildProcess, port: number): Promise<void> {
    const deadline = Date.now() + START_TIMEOUT_MS
    while (Date.now() < deadline) {
      if (this.spawnError) throw new Error(`Failed to start llama-server: ${this.spawnError}`)
      if (proc.exitCode !== null || proc.signalCode !== null) {
        throw new Error(
          `llama-server exited during model load (code=${proc.exitCode}, sig=${proc.signalCode}):\n${
            this.fullLog.trim() || 'no output'
          }`
        )
      }
      try {
        const res = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1500) })
        if (res.ok) {
          const j = (await res.json()) as { status?: string }
          if (j.status === 'ok') return
        }
      } catch {
        /* not ready yet */
      }
      await new Promise((r) => setTimeout(r, HEALTH_POLL_MS))
    }
    throw new Error(`Timed out waiting for llama-server (${START_TIMEOUT_MS / 1000}s):\n${this.logTail.trim() || 'no output'}`)
  }

  private buildArgs(port: number, modelPath: string): string[] {
    return [
      '--model',
      modelPath,
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--ctx-size',
      '4096',
      '--cache-type-k',
      'q8_0',
      '--cache-type-v',
      'q8_0',
      '--threads',
      '8',
      '--threads-batch',
      '16',
      '--gpu-layers',
      '0',
      '--webui',
      'none',
      '--reasoning',
      'off'
    ]
  }

  private bootOnce(modelPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      void (async () => {
        const bin = this.serverPath()
        const port = await findFreePort()
        const proc = spawn(bin, this.buildArgs(port, modelPath), {
          cwd: dirname(bin),
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe']
        })
        this.proc = proc
        this.intentionalExit = false
        this.spawnError = null
        proc.stdout?.on('data', (d: Buffer) => this.record(d.toString()))
        proc.stderr?.on('data', (d: Buffer) => this.record(d.toString()))
        proc.on('error', (err) => {
          if (!this.intentionalExit) this.spawnError = err.message
        })
        proc.on('exit', () => {
          this.proc = null
          this.currentModelPath = null
        })
        try {
          await this.waitHealthy(proc, port)
          this.port = port
          this.currentModelPath = modelPath
          resolve()
        } catch (e) {
          try {
            proc.kill()
          } catch {
            /* ignore */
          }
          reject(e)
        }
      })()
    })
  }

  private async boot(modelPath: string): Promise<void> {
    try {
      await this.bootOnce(modelPath)
    } catch (err) {
      this.killProc()
      await new Promise((r) => setTimeout(r, 600))
      await this.bootOnce(modelPath)
    }
  }

  private async ensureServer(modelPath: string): Promise<void> {
    if (this.proc && this.currentModelPath === modelPath) {
      if (await this.healthyNow()) return
      this.killProc()
    } else if (this.proc) {
      this.killProc()
    }
    if (this.booting) await this.booting
    if (this.proc && this.currentModelPath === modelPath) return
    this.booting = this.boot(modelPath)
    try {
      await this.booting
    } finally {
      this.booting = null
    }
  }

  async load(modelPath: string): Promise<{ name: string }> {
    await this.ensureServer(modelPath)
    return { name: modelPath.split(/[\\/]/).pop() ?? modelPath }
  }

  async unload(): Promise<void> {
    this.killProc()
  }

  async generate(
    modelPath: string,
    request: GenerationRequest,
    signal?: AbortSignal
  ): Promise<string> {
    await this.ensureServer(modelPath)
    if (!this.port) throw new Error('llama-server not running')

    const ac = new AbortController()
    const onAbort = (): void => ac.abort()
    signal?.addEventListener('abort', onAbort, { once: true })
    try {
      const res = await fetch(`http://127.0.0.1:${this.port}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ac.signal,
        body: JSON.stringify({
          messages: [
            { role: 'system', content: request.systemPrompt },
            { role: 'user', content: request.prompt }
          ],
          temperature: request.temperature,
          top_p: request.topP,
          max_tokens: request.maxTokens,
          stream: true
        })
      })
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '')
        throw new Error(`llama-server returned ${res.status}: ${text.slice(0, 500) || this.logTail.trim().slice(-800)}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let text = ''
      try {
        outer: for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          let idx: number
          while ((idx = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, idx).trim()
            buffer = buffer.slice(idx + 1)
            if (!line.startsWith('data:')) continue
            const payload = line.slice(5).trim()
            if (payload === '[DONE]') break outer
            try {
              const j = JSON.parse(payload) as {
                choices?: Array<{ delta?: { content?: string } }>
              }
              const piece = j.choices?.[0]?.delta?.content
              if (piece) text += piece
            } catch {
              /* partial json line; ignore */
            }
          }
        }
return cleanScaffold(text)
      } catch (e) {
        if (ac.signal.aborted) throw new Error('Generation cancelled')
        throw e
      } finally {
        try {
          await reader.cancel()
        } catch {
          /* ignore */
        }
      }
    } finally {
      signal?.removeEventListener('abort', onAbort)
    }
  }

  async loadedModel(): Promise<string | null> {
    if (!this.proc || !this.currentModelPath) return null
    return this.currentModelPath.split(/[\\/]/).pop() ?? this.currentModelPath
  }

  async dispose(): Promise<void> {
    this.killProc()
    this.booting = null
  }
}

export const llamaWorker = new LlamaServerClient()