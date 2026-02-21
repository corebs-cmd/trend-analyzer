import { useState, useEffect } from 'react'
import './AvatarStep.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Module-level cache so config is fetched once per page load
let cachedConfig = null
let configFetchPromise = null

export default function AvatarStep({ analysis, step2, onGenerate }) {
  const [config, setConfig] = useState(cachedConfig)
  const [configLoading, setConfigLoading] = useState(!cachedConfig)
  const [configError, setConfigError] = useState('')
  const [selectedAvatarId, setSelectedAvatarId] = useState('')
  const [selectedVoiceId, setSelectedVoiceId] = useState('')

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

  const isLoading = step2.status === 'loading'
  const isDone = step2.status === 'done'
  const isError = step2.status === 'error'
  const canGenerate = selectedAvatarId && selectedVoiceId && !isLoading

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

            {/* Script note */}
            {analysis?.video_proposal?.hook && (
              <div className="avs-script-note">
                <span className="avs-label">Will speak a script starting with</span>
                <blockquote className="avs-hook-preview">
                  "{analysis.video_proposal.hook}"
                </blockquote>
                <p className="avs-script-sub">Full 20–30 second script auto-generated by Claude on submit · Avatar renders on green screen for compositing</p>
              </div>
            )}

            {/* Generate Button */}
            <button
              className="avs-btn-generate"
              onClick={() => onGenerate(selectedAvatarId, selectedVoiceId)}
              disabled={!canGenerate}
            >
              {isLoading ? '⏳ Generating Avatar…'
                : step2.hasGenerated ? '🔄 Regenerate Avatar'
                : '🎭 Generate Avatar Video'}
            </button>
          </>
        )}

        {/* Error message */}
        {isError && (
          <div className="avs-error-msg">
            ❌ {step2.error || 'Generation failed'}
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="avs-generating-card">
            <div className="avs-pulse-ring" />
            <p>HeyGen is rendering the avatar video…</p>
            <p className="avs-gen-sub">This usually takes 2–5 minutes</p>
          </div>
        )}

        {/* Done: video preview */}
        {isDone && step2.videoUrl && (
          <div className="avs-video-result">
            <span className="avs-label">Avatar Video (Green Screen)</span>
            <video
              src={step2.videoUrl}
              controls
              className="avs-video-player"
              playsInline
            />
            <p className="avs-video-note">
              Green screen background will be replaced with your chosen scene in Step 4
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
