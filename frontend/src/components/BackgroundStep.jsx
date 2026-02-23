import { useState, useEffect, useRef } from 'react'
import './BackgroundStep.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const MODELS = [
  { id: 'kling', label: 'Kling 2.6 Pro', note: 'via fal.ai' },
  { id: 'runway', label: 'Runway gen4.5', note: 'via RunwayML' },
]

// slot: 'A' | 'B', imageState: { previewUrl, uploadedUrl, uploading, error } | null
function SlotImageUpload({ slot, imageState, onImageSelected, onImageCleared, disabled }) {
  const inputRef = useRef(null)
  const colorClass = slot === 'A' ? 'bgs-img-slot-a' : 'bgs-img-slot-b'

  async function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) return
    const previewUrl = URL.createObjectURL(file)
    onImageSelected({ previewUrl, uploadedUrl: null, uploading: true, error: null })

    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${API_BASE}/pipeline/upload-image`, { method: 'POST', body: form })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || `Upload failed (${res.status})`)
      }
      const data = await res.json()
      onImageSelected({ previewUrl, uploadedUrl: data.url, uploading: false, error: null })
    } catch (e) {
      onImageSelected({ previewUrl, uploadedUrl: null, uploading: false, error: e.message })
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    if (disabled) return
    const file = e.dataTransfer.files[0]
    handleFile(file)
  }

  function handleChange(e) {
    handleFile(e.target.files[0])
    e.target.value = ''
  }

  if (imageState) {
    return (
      <div className={`bgs-img-preview ${colorClass}`}>
        <img src={imageState.previewUrl} alt={`Slot ${slot}`} className="bgs-img-thumb" />
        <div className="bgs-img-preview-info">
          {imageState.uploading && <span className="bgs-img-uploading">⏳ Uploading…</span>}
          {imageState.error && <span className="bgs-img-error" title={imageState.error}>❌ Upload failed</span>}
          {imageState.uploadedUrl && <span className="bgs-img-ready">✅ Image ready</span>}
        </div>
        <button
          className="bgs-img-clear"
          onClick={onImageCleared}
          title="Remove image"
          disabled={disabled}
        >✕</button>
      </div>
    )
  }

  return (
    <div
      className={`bgs-img-dropzone ${colorClass} ${disabled ? 'bgs-img-disabled' : ''}`}
      onDrop={handleDrop}
      onDragOver={e => e.preventDefault()}
      onClick={() => !disabled && inputRef.current?.click()}
      title={`Optional: add an image for Slot ${slot} (image-to-video)`}
    >
      <span className="bgs-img-icon">🖼</span>
      <span className="bgs-img-label">Add image <span className="bgs-img-optional">(optional)</span></span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="bgs-img-input"
        onChange={handleChange}
        disabled={disabled}
      />
    </div>
  )
}

export default function BackgroundStep({ analysis, hashtags, proposalsEndpoint, step3, onGenerate, onReset, onRegenerateSlot }) {
  const [proposals, setProposals] = useState([])
  const [proposalsLoading, setProposalsLoading] = useState(false)
  const [proposalsError, setProposalsError] = useState('')
  const [selectedA, setSelectedA] = useState(null) // { index, prompt, label }
  const [selectedB, setSelectedB] = useState(null)
  const [selectedModel, setSelectedModel] = useState('kling')
  const [imageA, setImageA] = useState(null) // { previewUrl, uploadedUrl, uploading, error }
  const [imageB, setImageB] = useState(null)

  useEffect(() => {
    if (analysis && hashtags) fetchProposals()
  }, [analysis, hashtags])

  async function fetchProposals() {
    setProposalsLoading(true)
    setProposalsError('')
    try {
      const res = await fetch(`${API_BASE}${proposalsEndpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis, hashtags }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || `Server error ${res.status}`)
      }
      const data = await res.json()
      setProposals(data.proposals)
    } catch (e) {
      setProposalsError(e.message)
    } finally {
      setProposalsLoading(false)
    }
  }

  function assignSlot(slot, index) {
    const p = proposals[index]
    if (slot === 'A') {
      if (selectedB?.index === index) setSelectedB(null)
      setSelectedA({ index, prompt: p.prompt, label: p.label })
    } else {
      if (selectedA?.index === index) setSelectedA(null)
      setSelectedB({ index, prompt: p.prompt, label: p.label })
    }
  }

  const isUploading = imageA?.uploading || imageB?.uploading
  const canGenerate = selectedA && selectedB && step3.status !== 'loading' && !isUploading
  const isLoading = step3.status === 'loading'
  const hasDone = step3.backgrounds.some(b => b.status === 'succeeded')
  const hasGenerated = step3.hasGenerated

  function slotOf(index) {
    if (selectedA?.index === index) return 'A'
    if (selectedB?.index === index) return 'B'
    return null
  }

  function handleReset() {
    setSelectedA(null)
    setSelectedB(null)
    setSelectedModel('kling')
    setImageA(null)
    setImageB(null)
    onReset()
  }

  function handleGenerate() {
    onGenerate(
      selectedA.prompt,
      selectedB.prompt,
      selectedModel,
      imageA?.uploadedUrl || null,
      imageB?.uploadedUrl || null,
    )
  }

  return (
    <div className="background-step">
      <div className="bgs-header">
        <div className="bgs-step-badge">STEP 3</div>
        <h3 className="bgs-title">Background Scenes</h3>
        <span className="bgs-model-tag">Runway · Kling</span>
        {hasDone && <span className="bgs-status-done">✅ Ready</span>}
        {isLoading && !hasDone && <span className="bgs-status-loading">⏳ Generating…</span>}
        {hasGenerated && !isLoading && (
          <button className="bgs-reset-btn" onClick={handleReset} title="Clear results and pick new prompts">
            ↺ Start Over
          </button>
        )}
      </div>

      <div className="bgs-body">
        {/* Model selector */}
        <div className="bgs-section">
          <span className="bgs-label">Video Model</span>
          <div className="bgs-model-row">
            {MODELS.map(m => (
              <button
                key={m.id}
                className={`bgs-model-btn ${selectedModel === m.id ? 'bgs-model-selected' : ''}`}
                onClick={() => setSelectedModel(m.id)}
                disabled={isLoading}
              >
                <span className="bgs-model-name">{m.label}</span>
                <span className="bgs-model-note">{m.note}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Slot summary + image upload */}
        <div className="bgs-slots-row">
          <div className={`bgs-slot ${selectedA ? 'bgs-slot-filled' : 'bgs-slot-empty'}`}>
            <span className="bgs-slot-letter bgs-slot-a">A</span>
            <div className="bgs-slot-body">
              <span className="bgs-slot-text">
                {selectedA ? selectedA.label : 'Click a prompt below to set Slot A'}
              </span>
              <SlotImageUpload
                slot="A"
                imageState={imageA}
                onImageSelected={setImageA}
                onImageCleared={() => setImageA(null)}
                disabled={isLoading}
              />
            </div>
          </div>
          <div className={`bgs-slot ${selectedB ? 'bgs-slot-filled' : 'bgs-slot-empty'}`}>
            <span className="bgs-slot-letter bgs-slot-b">B</span>
            <div className="bgs-slot-body">
              <span className="bgs-slot-text">
                {selectedB ? selectedB.label : 'Click a prompt below to set Slot B'}
              </span>
              <SlotImageUpload
                slot="B"
                imageState={imageB}
                onImageSelected={setImageB}
                onImageCleared={() => setImageB(null)}
                disabled={isLoading}
              />
            </div>
          </div>
        </div>

        {/* Proposals */}
        {proposalsLoading && (
          <div className="bgs-proposals-loading">
            <div className="bgs-spinner" />
            <span>Claude is crafting 7 background prompts…</span>
          </div>
        )}
        {proposalsError && (
          <div className="bgs-proposals-error">
            ⚠️ {proposalsError}
            <button className="bgs-retry" onClick={fetchProposals}>Retry</button>
          </div>
        )}

        {proposals.length > 0 && (
          <div className="bgs-section">
            <span className="bgs-label">Select 2 prompts — one for Slot A, one for Slot B</span>
            <div className="bgs-proposals-grid">
              {proposals.map((p, i) => {
                const slot = slotOf(i)
                return (
                  <div
                    key={i}
                    className={`bgs-proposal-card ${slot === 'A' ? 'bgs-card-a' : slot === 'B' ? 'bgs-card-b' : ''}`}
                  >
                    <div className="bgs-card-top">
                      <span className="bgs-card-label">{p.label}</span>
                      {slot && <span className={`bgs-card-slot-badge bgs-badge-${slot.toLowerCase()}`}>Slot {slot}</span>}
                    </div>
                    <p className="bgs-card-desc">{p.description}</p>
                    <p className="bgs-card-prompt">{p.prompt}</p>
                    <div className="bgs-card-actions">
                      <button
                        className={`bgs-slot-btn bgs-slot-btn-a ${slot === 'A' ? 'active' : ''}`}
                        onClick={() => assignSlot('A', i)}
                        disabled={isLoading}
                      >
                        {slot === 'A' ? '✓ Slot A' : 'Set as A'}
                      </button>
                      <button
                        className={`bgs-slot-btn bgs-slot-btn-b ${slot === 'B' ? 'active' : ''}`}
                        onClick={() => assignSlot('B', i)}
                        disabled={isLoading}
                      >
                        {slot === 'B' ? '✓ Slot B' : 'Set as B'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Generate button */}
        <button
          className="bgs-btn-generate"
          onClick={handleGenerate}
          disabled={!canGenerate}
        >
          {isUploading ? '⏳ Uploading image…'
            : isLoading ? '⏳ Generating Backgrounds…'
            : step3.hasGenerated ? '🔄 Regenerate Backgrounds'
            : '🎬 Generate 2 Background Scenes'}
        </button>

        {/* Error */}
        {step3.status === 'error' && (
          <div className="bgs-error-msg">❌ {step3.error}</div>
        )}

        {/* Background video cards */}
        {step3.backgrounds.length > 0 && (
          <div className="bgs-results">
            {step3.backgrounds.map((bg, i) => (
              <div key={i} className={`bgs-result-card bgs-result-${bg.slot?.toLowerCase()}`}>
                <div className="bgs-result-header">
                  <span className={`bgs-result-slot bgs-badge-${bg.slot?.toLowerCase()}`}>Slot {bg.slot}</span>
                  <span className="bgs-result-model">{bg.model || selectedModel}</span>
                  <span className={`bgs-result-status bgs-status-${bg.status}`}>
                    {bg.status === 'succeeded' ? '✅ Ready'
                      : bg.status === 'pending' ? '⏳ Rendering…'
                      : bg.status === 'failed' ? '❌ Failed'
                      : '❌ Error'}
                  </span>
                </div>
                <p className="bgs-result-prompt">{bg.prompt}</p>
                {bg.status === 'succeeded' && bg.video_url && (
                  <video src={bg.video_url} controls className="bgs-result-video" playsInline />
                )}
                {(bg.status === 'pending' || bg.status === 'pending-submit') && (
                  <div className="bgs-result-pending">
                    <div className="bgs-spinner" />
                    <span>{bg.status === 'pending-submit' ? 'Submitting…' : 'Rendering 10-second clip…'}</span>
                  </div>
                )}
                {(bg.status === 'failed' || bg.status === 'error') && (
                  <p className="bgs-result-error">{bg.error}</p>
                )}
                {(bg.status === 'succeeded' || bg.status === 'failed' || bg.status === 'error') && onRegenerateSlot && (
                  <button
                    className="bgs-rerun-btn"
                    onClick={() => {
                      const sel = bg.slot === 'A' ? selectedA : selectedB
                      const img = bg.slot === 'A' ? imageA : imageB
                      if (sel) onRegenerateSlot(bg.slot, sel.prompt, selectedModel, img?.uploadedUrl || null)
                    }}
                    title={`Re-run Slot ${bg.slot} with current prompt & image selection`}
                  >
                    ↺ Re-run
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
