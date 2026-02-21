import { useState, useEffect, useRef } from 'react'
import './VideoPanel.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const POLL_INTERVAL_MS = 6000 // poll every 6 seconds

function StatusBadge({ status }) {
  const map = {
    succeeded: { label: '✅ Ready', cls: 'status-ok' },
    error: { label: '❌ Failed', cls: 'status-err' },
    failed: { label: '❌ Failed', cls: 'status-err' },
    timeout: { label: '⏱ Timed out', cls: 'status-err' },
    cancelled: { label: '🚫 Cancelled', cls: 'status-err' },
  }
  const s = map[status?.toLowerCase()] || { label: '⏳ Rendering…', cls: 'status-pending' }
  return <span className={`status-badge ${s.cls}`}>{s.label}</span>
}

function VideoCard({ video, index, onStatusUpdate }) {
  const [expanded, setExpanded] = useState(false)
  const pollRef = useRef(null)

  useEffect(() => {
    // Only poll if we have a task_id and aren't done yet
    const isDone = ['succeeded', 'failed', 'error', 'cancelled', 'timeout'].includes(
      video.status?.toLowerCase()
    )
    if (!video.task_id || isDone) return

    // Route to the right polling endpoint based on platform
    const platform = video.platform?.toLowerCase() || ''
    const provider = platform.includes('luma') ? 'luma'
      : platform === 'pika' ? 'pika'
      : platform === 'hailuo' ? 'hailuo'
      : platform.includes('fal') || platform === 'kling' ? 'kling'
      : 'runway'
    const pollUrl = `${API_BASE}/video-status/${provider}/${video.task_id}`

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(pollUrl)
        if (!res.ok) return
        const data = await res.json()
        if (data.status !== 'pending') {
          clearInterval(pollRef.current)
          onStatusUpdate(index, data)
        }
      } catch {
        // silently ignore poll errors
      }
    }, POLL_INTERVAL_MS)

    return () => clearInterval(pollRef.current)
  }, [video.task_id, video.status, index, onStatusUpdate])

  return (
    <div className="video-card">
      {/* Header */}
      <div className="vc-header">
        <span className="vc-number">#{index + 1}</span>
        <div className="vc-title-block">
          <h3 className="vc-title">{video.title}</h3>
          <span className="vc-angle">{video.angle}</span>
        </div>
        <div className="vc-header-right">
          {video.platform && video.model && (
            <span className="vc-model-tag">{video.platform} · {video.model}</span>
          )}
          <StatusBadge status={video.status} />
        </div>
      </div>

      {/* Video player or placeholder */}
      <div className="vc-player-wrap">
        {video.video_url ? (
          <video
            className="vc-player"
            src={video.video_url}
            controls
            playsInline
            poster=""
          />
        ) : (
          <div className="vc-player-placeholder">
            {video.status === 'succeeded'
              ? '⚠️ No video URL returned'
              : video.status === 'error' || video.status === 'failed'
              ? `❌ ${video.error || 'Generation failed'}`
              : (
                <div className="vc-rendering">
                  <div className="vc-mini-spinner" />
                  <span>{video.platform || 'RunwayML'} · {video.model || 'rendering'}…</span>
                </div>
              )}
          </div>
        )}
      </div>

      {/* Hook */}
      <div className="vc-section">
        <span className="vc-label">Hook (first 3 sec)</span>
        <blockquote className="vc-hook">"{video.hook}"</blockquote>
      </div>

      {/* Script outline toggle */}
      <button className="vc-toggle" onClick={() => setExpanded(e => !e)}>
        {expanded ? '▲ Hide script' : '▼ Show script outline'}
      </button>

      {expanded && video.script_outline && (
        <div className="vc-script">
          {video.script_outline.map((step, i) => (
            <div key={i} className="vc-step">
              <span className="vc-step-time">{step.timestamp}</span>
              <span className="vc-step-action">{step.action}</span>
            </div>
          ))}
        </div>
      )}

      {/* Runway prompt — always visible */}
      {video.runway_prompt && (
        <div className="vc-section vc-prompt-section">
          <span className="vc-label">Full prompt sent to {video.platform || 'RunwayML'}</span>
          <p className="vc-prompt-text">{video.runway_prompt}</p>
        </div>
      )}

      {/* Hashtags */}
      {video.hashtags && video.hashtags.length > 0 && (
        <div className="vc-hashtags">
          {video.hashtags.map((tag, i) => (
            <span key={i} className="vc-hashtag">#{tag.replace(/^#/, '')}</span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function VideoPanel({ videos: initialVideos, loading, error }) {
  const [videos, setVideos] = useState(initialVideos || [])

  // Sync if parent resets videos
  useEffect(() => {
    setVideos(initialVideos || [])
  }, [initialVideos])

  const handleStatusUpdate = (index, statusData) => {
    setVideos(prev => {
      const updated = [...prev]
      updated[index] = {
        ...updated[index],
        status: statusData.status,
        video_url: statusData.video_url || updated[index].video_url,
        error: statusData.error,
      }
      return updated
    })
  }

  if (loading) {
    return (
      <div className="video-panel-loading">
        <div className="vp-spinner" />
        <div>
          <p className="vp-loading-title">Generating video concept…</p>
          <p className="vp-loading-sub">Claude writes the script · Submits to RunwayML veo3.1 + Gen-4, Kling 2.6 Pro, Pika 2.2 &amp; Luma simultaneously · Cards appear in seconds</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="video-panel-error">
        <span>⚠️</span>
        <div>
          <p className="vp-error-title">Video generation failed</p>
          <p className="vp-error-sub">{error}</p>
        </div>
      </div>
    )
  }

  if (!videos || videos.length === 0) return null

  const doneCount = videos.filter(v =>
    ['succeeded', 'failed', 'error', 'cancelled'].includes(v.status?.toLowerCase())
  ).length
  const readyCount = videos.filter(v => v.status?.toLowerCase() === 'succeeded').length

  return (
    <div className="video-panel">
      <div className="vp-header">
        <h2>🎬 AI Generated Video Concepts</h2>
        <span className="vp-sub">
          {doneCount < videos.length
            ? `Rendering… updates automatically`
            : `${readyCount} of ${videos.length} rendered · Same concept, different models — pick your favourite`}
        </span>
      </div>
      <div className="video-grid">
        {videos.map((v, i) => (
          <VideoCard key={i} video={v} index={i} onStatusUpdate={handleStatusUpdate} />
        ))}
      </div>
    </div>
  )
}
