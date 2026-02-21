import { useState, useEffect } from 'react'
import './HeyGenPanel.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Module-level cache so config is fetched once per page load
let cachedConfig = null
let configFetchPromise = null

export default function HeyGenPanel({
  analysis,
  hashtags,
  onGenerate,
  loading,
  hasGeneratedOnce,
}) {
  const [config, setConfig] = useState(cachedConfig)
  const [configLoading, setConfigLoading] = useState(!cachedConfig)
  const [configError, setConfigError] = useState('')
  const [selectedAvatarId, setSelectedAvatarId] = useState('')
  const [selectedVoiceId, setSelectedVoiceId] = useState('')

  useEffect(() => {
    if (cachedConfig) return // already loaded

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
        configFetchPromise = null // allow retry
      })
  }, [])

  // Set defaults once config arrives (for subsequent mounts)
  useEffect(() => {
    if (config && !selectedAvatarId && config.avatars?.length) {
      setSelectedAvatarId(config.avatars[0].avatar_id)
    }
    if (config && !selectedVoiceId && config.voices?.length) {
      setSelectedVoiceId(config.voices[0].voice_id)
    }
  }, [config])

  const canGenerate = selectedAvatarId && selectedVoiceId && !loading

  return (
    <div className="heygen-panel">
      {/* Header */}
      <div className="hgp-header">
        <div className="hgp-header-top">
          <span className="hgp-icon">🎭</span>
          <h3 className="hgp-title">HeyGen Avatar IV</h3>
          <span className="hgp-badge">Talking Head Video</span>
        </div>
        <p className="hgp-description">
          A photorealistic AI avatar speaks your script directly to camera.
          This is a separate format from cinematic models — <strong>only HeyGen generates</strong> when you click below.
          The other models are not affected.
        </p>
      </div>

      {/* Config loading / error */}
      {configLoading && (
        <div className="hgp-config-loading">
          <div className="hgp-mini-spinner" />
          <span>Loading avatars & voices…</span>
        </div>
      )}

      {configError && (
        <div className="hgp-config-error">⚠️ {configError}</div>
      )}

      {config && (
        <div className="hgp-body">
          {/* Avatar Grid */}
          <div className="hgp-section">
            <label className="hgp-label">
              Choose Avatar
              <span className="hgp-label-note">Avatar IV · {config.avatars.length} available</span>
            </label>
            {config.avatars.length === 0 ? (
              <p className="hgp-empty">No Avatar IV avatars found in your HeyGen account.</p>
            ) : (
              <div className="hgp-avatar-grid">
                {config.avatars.map(a => (
                  <button
                    key={a.avatar_id}
                    className={`hgp-avatar-card ${selectedAvatarId === a.avatar_id ? 'hgp-avatar-selected' : ''}`}
                    onClick={() => setSelectedAvatarId(a.avatar_id)}
                    title={a.name}
                  >
                    {a.thumbnail ? (
                      <img src={a.thumbnail} alt={a.name} className="hgp-avatar-img" />
                    ) : (
                      <div className="hgp-avatar-placeholder">👤</div>
                    )}
                    <span className="hgp-avatar-name">{a.name}</span>
                    {a.gender && <span className="hgp-avatar-gender">{a.gender}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Voice Picker */}
          <div className="hgp-section">
            <label className="hgp-label" htmlFor="hgp-voice-select">
              Choose Voice
              <span className="hgp-label-note">English · {config.voices.length} available</span>
            </label>
            <select
              id="hgp-voice-select"
              className="hgp-voice-select"
              value={selectedVoiceId}
              onChange={e => setSelectedVoiceId(e.target.value)}
            >
              {config.voices.map(v => (
                <option key={v.voice_id} value={v.voice_id}>
                  {v.name}{v.gender ? ` · ${v.gender}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Script direction preview */}
          {analysis?.video_proposal?.hook && (
            <div className="hgp-section hgp-script-preview">
              <label className="hgp-label">
                Content direction
                <span className="hgp-label-note">Avatar will deliver a script based on this</span>
              </label>
              <blockquote className="hgp-hook">"{analysis.video_proposal.hook}"</blockquote>
              <p className="hgp-script-note">
                Full 30-second spoken script is generated by Claude on submit
              </p>
            </div>
          )}

          {/* Generate Button */}
          <button
            className="hgp-btn-generate"
            onClick={() => onGenerate(selectedAvatarId, selectedVoiceId)}
            disabled={!canGenerate}
          >
            {loading
              ? '⏳ Generating Avatar Video…'
              : hasGeneratedOnce
              ? '🔄 Regenerate Avatar Video'
              : '🎭 Generate HeyGen Avatar Video'}
          </button>
        </div>
      )}
    </div>
  )
}
