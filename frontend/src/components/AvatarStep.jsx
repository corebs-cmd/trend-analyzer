import { useState, useEffect } from 'react'
import './AvatarStep.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Module-level cache so avatar/voice config is fetched once per page load
let cachedConfig = null
let configFetchPromise = null

export default function AvatarStep({ analysis, hashtags, platform = 'instagram', step2, onGenerate }) {
  const [config, setConfig] = useState(cachedConfig)
  const [configLoading, setConfigLoading] = useState(!cachedConfig)
  const [configError, setConfigError] = useState('')
  const [selectedAvatarId, setSelectedAvatarId] = useState('')
  const [selectedVoiceId, setSelectedVoiceId] = useState('')

  // Script preview state
  const [scriptText, setScriptText] = useState('')
  const [scriptLoading, setScriptLoading] = useState(false)
  const [scriptError, setScriptError] = useState('')
  const [scriptFetched, setScriptFetched] = useState(false)

  // Load avatar/voice config once
  useEffect(() => {
    if (cachedConfig) return
    if (!configFetchPromise) {
      configFetchPromise = fetch(`${API_BASE}/heygen/config`).then(r => {
        if (!r.ok) return r.json().then(e => Promise.reject(e.detail || 'Failed to load'))
        return r.json()
      })
    }
    configFetchPromise
      .then(data => {
        cachedConfig = data
        setConfig(data)
        if (data.avatars?.length) setSelectedAvatarId(data.avatars[0].avatar_id)
        if (data.voices?.length) setSelectedVoiceId(data.voices[0].voice_id)
        setConfigLoading(false)
      })
      .catch(err => {
        setConfigError(typeof err === 'string' ? err : 'Could not load HeyGen avatars & voices')
        setConfigLoading(false)
        configFetchPromise = null
      })
  }, [])

  useEffect(() => {
    if (config && !selectedAvatarId && config.avatars?.length) setSelectedAvatarId(config.avatars[0].avatar_id)
    if (config && !selectedVoiceId && config.voices?.length) setSelectedVoiceId(config.voices[0].voice_id)
  }, [config])

  // Auto-fetch script when analysis is available
  useEffect(() => {
    if (analysis && hashtags && !scriptFetched && !scriptLoading) {
      fetchScript()
    }
  }, [analysis, hashtags])

  async function fetchScript() {
    setScriptLoading(true)
    setScriptError('')
    try {
      const res = await fetch(`${API_BASE}/heygen/preview-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis, hashtags, platform }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || `Error ${res.status}`)
      }
      const data = await res.json()
      setScriptText(data.spoken_script)
      setScriptFetched(true)
    } catch (e) {
      setScriptError(e.message)
    } finally {
      setScriptLoading(false)
    }
  }

  const isLoading = step2.status === 'loading'
  const isDone = step2.status === 'done'
  const isError = step2.status === 'error'
  const canGenerate = selectedAvatarId && selectedVoiceId && !isLoading && scriptText.trim().length > 0

  const wordCount = scriptText.trim().split(/\s+/).filter(Boolean).length
  const approxSeconds = Math.round(wordCount / 2.2)

  return (
    <div className="avatar-step">
      <div className="avs-header">
        <div className="avs-step-badge">STEP 2</div>
        <h3 className="avs-title">Talking Head Avatar</h3>
        <span className="avs-model-badge">HeyGen Avatar IV</span>
        {isDone && <span className="avs-status-done">✅ Done</span>}
        {isLoading && <span className="avs-status-loading">⏳ Generating…</span>}
        {isError && <span className="avs-status-error">❌ Error</span>}
      </div>

      <div className="avs-body">
        {configLoading && (
          <div className="avs-config-loading">
            <div className="avs-spinner" />
            <span>Loading avatars &amp; voices…</span>
          </div>
        )}
        {configError && <div className="avs-config-error">⚠️ {configError}</div>}

        {config && (
          <>
            {/* Avatar Grid */}
            <div className="avs-section">
              <label className="avs-label">
                Choose Avatar
                <span className="avs-label-note">{config.avatars.length} available · scroll to see all</span>
              </label>
              <div className="avs-avatar-grid">
                {config.avatars.map(a => (
                  <button
                    key={a.avatar_id}
                    className={`avs-avatar-card ${selectedAvatarId === a.avatar_id ? 'avs-avatar-selected' : ''}`}
                    onClick={() => setSelectedAvatarId(a.avatar_id)}
                    title={a.name}
                    disabled={isLoading}
                  >
                    {a.thumbnail
                      ? <img src={a.thumbnail} alt={a.name} className="avs-avatar-img" />
                      : <div className="avs-avatar-placeholder">👤</div>}
                    <span className="avs-avatar-name">{a.name}</span>
                    {a.is_avatar_iv && <span className="avs-iv-tag">IV</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Voice Picker */}
            <div className="avs-section">
              <label className="avs-label" htmlFor="avs-voice">
                Choose Voice
                <span className="avs-label-note">English · {config.voices.length} available</span>
              </label>
              <select
                id="avs-voice"
                className="avs-voice-select"
                value={selectedVoiceId}
                onChange={e => setSelectedVoiceId(e.target.value)}
                disabled={isLoading}
              >
                {config.voices.map(v => (
                  <option key={v.voice_id} value={v.voice_id}>
                    {v.name}{v.gender ? ` · ${v.gender}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* ── Script Preview / Editor ── */}
            <div className="avs-section">
              <div className="avs-script-header">
                <label className="avs-label">
                  Spoken Script
                  <span className="avs-label-note">exact text sent to HeyGen · edit freely</span>
                </label>
                <div className="avs-script-meta">
                  {scriptText && (
                    <span className={`avs-word-count ${wordCount > 65 ? 'avs-word-count--over' : ''}`}>
                      {wordCount} words · ~{approxSeconds}s
                    </span>
                  )}
                  <button
                    className="avs-refresh-script"
                    onClick={fetchScript}
                    disabled={scriptLoading || isLoading}
                    title="Regenerate script from Claude"
                  >
                    {scriptLoading ? '⏳' : '↻'} Regenerate
                  </button>
                </div>
              </div>

              {scriptLoading && (
                <div className="avs-script-loading">
                  <div className="avs-spinner" />
                  <span>Claude is writing the script…</span>
                </div>
              )}

              {scriptError && (
                <div className="avs-config-error">⚠️ {scriptError}</div>
              )}

              {!scriptLoading && (
                <textarea
                  className="avs-script-textarea"
                  value={scriptText}
                  onChange={e => setScriptText(e.target.value)}
                  placeholder="Script will appear here…"
                  rows={5}
                  disabled={isLoading}
                  spellCheck
                />
              )}

              <p className="avs-script-hint">
                This exact text will be spoken by the avatar. Aim for under 65 words (~30s). Hit ↻ Regenerate for a fresh version.
              </p>
            </div>

            {/* Generate Button */}
            <button
              className="avs-btn-generate"
              onClick={() => onGenerate(selectedAvatarId, selectedVoiceId, scriptText.trim())}
              disabled={!canGenerate}
            >
              {isLoading ? '⏳ Generating Avatar…'
                : step2.hasGenerated ? '🔄 Regenerate Avatar'
                : '🎭 Generate Avatar Video'}
            </button>
          </>
        )}

        {isError && (
          <div className="avs-error-msg">❌ {step2.error || 'Generation failed'}</div>
        )}

        {isLoading && (
          <div className="avs-generating-card">
            <div className="avs-pulse-ring" />
            <p>HeyGen is rendering the avatar video…</p>
            <p className="avs-gen-sub">This usually takes 2–5 minutes</p>
          </div>
        )}

        {isDone && step2.videoUrl && (
          <div className="avs-video-result">
            <span className="avs-label">Avatar Video (Green Screen)</span>
            <video src={step2.videoUrl} controls className="avs-video-player" playsInline />
            <p className="avs-video-note">
              Green screen background will be replaced with your chosen scene in Step 4
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
