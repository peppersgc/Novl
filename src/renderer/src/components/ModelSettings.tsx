import { useEffect, useState } from 'react'
import { X, FolderOpen } from 'lucide-react'
import { useStore } from '../store'
import { formatBytes } from '../lib/mark'
import type { ModelInfo } from '../../../shared/types'

export function ModelSettings() {
  const open = useStore((s) => s.showSettings)
  const setOpen = useStore((s) => s.setSettingsOpen)
  const config = useStore((s) => s.config)
  const models = useStore((s) => s.models)
  const refreshModels = useStore((s) => s.refreshModels)
  const setConfig = useStore((s) => s.setConfig)
  const initModel = useStore((s) => s.initModel)
  const showToast = useStore((s) => s.showToast)

  const [modelPath, setModelPath] = useState<string>('')
  const [temp, setTemp] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(1024)
  const [ext, setExt] = useState<ModelInfo | null>(null)

  useEffect(() => {
    if (!open) return
    void refreshModels()
    setExt(null)
    if (config) {
      setModelPath(config.modelPath ?? '')
      setTemp(config.temperature)
      setMaxTokens(config.maxTokens)
    }
  }, [open])

  if (!open) return null

  const allModels: ModelInfo[] = ext && !models.some((m) => m.path === ext.path) ? [...models, ext] : models

  const browse = async (): Promise<void> => {
    const picked = await window.novl.ai.pickModel()
    if (picked) {
      setExt(picked)
      setModelPath(picked.path)
    }
  }

  const save = async (): Promise<void> => {
    const picked = allModels.find((m) => m.path === modelPath)
    await setConfig({
      modelPath: picked ? picked.path : null,
      loadedModelName: picked ? picked.name : null,
      temperature: temp,
      maxTokens
    })
    await initModel()
    showToast(picked ? `Model set: ${picked.name}` : 'Model selection cleared')
    setOpen(false)
  }

  return (
    <div className="modal-mask" onClick={() => setOpen(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>AI settings</h2>
          <button className="icon-btn" onClick={() => setOpen(false)}>
            <X size={16} />
          </button>
        </div>

        <label className="field-label">Model (.gguf file anywhere on disk)</label>
        <div className="model-pick-row">
          <select
            className="select flex"
            value={modelPath}
            onChange={(e) => setModelPath(e.target.value)}
          >
            <option value="">- no model -</option>
            {allModels.length === 0 && (
              <option value="" disabled>
                No models found - use Browse
              </option>
            )}
            {allModels.map((m: ModelInfo) => (
              <option key={m.path} value={m.path}>
                {m.name} ({formatBytes(m.size)})
              </option>
            ))}
          </select>
          <button className="btn" onClick={() => void browse()} title="Browse for a .gguf model">
            <FolderOpen size={14} /> Browse...
          </button>
        </div>

        <label className="field-label">
          Temperature: <strong>{temp.toFixed(2)}</strong>
        </label>
        <input
          type="range"
          min={0}
          max={2}
          step={0.05}
          value={temp}
          onChange={(e) => setTemp(Number(e.target.value))}
        />

        <label className="field-label">Max tokens: {maxTokens}</label>
        <input
          type="range"
          min={256}
          max={4096}
          step={128}
          value={maxTokens}
          onChange={(e) => setMaxTokens(Number(e.target.value))}
        />

        <div className="modal-actions">
          <button className="btn" onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button className="btn primary" onClick={() => void save()}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}