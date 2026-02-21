import { useState, useEffect } from 'react'
import ScriptStep from './ScriptStep'
import AvatarStep from './AvatarStep'
import BackgroundStep from './BackgroundStep'
import CompositeStep from './CompositeStep'
import './PipelineView.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const INITIAL_STEP2 = {
  status: 'idle',   // idle | loading | done | error
  videoId: null,
  videoUrl: null,
  spokenScript: '',
  hasGenerated: false,
  error: '',
}
const INITIAL_STEP3 = {
  status: 'idle',
  backgrounds: [],  // [{task_id, slot, platform, model, prompt, status, video_url}]
  hasGenerated: false,
  error: '',
}
const INITIAL_STEP4 = {
  selectedMusic: 'hype',
  composites: [],   // [{slot, render_id, status, video_url, error}]
}

export default function PipelineView({ analysis, hashtags, platform = 'instagram' }) {
  const [step2, setStep2] = useState(INITIAL_STEP2)
  const [step3, setStep3] = useState(INITIAL_STEP3)
  const [step4, setStep4] = useState(INITIAL_STEP4)
  const [musicTracks, setMusicTracks] = useState([])

  const proposalsEndpoint = platform === 'tiktok' ? '/tiktok/propose-prompts' : '/propose-prompts'

  // Load music tracks once
  useEffect(() => {
    fetch(`${API_BASE}/pipeline/music-tracks`)
      .then(r => r.json())
      .then(d => setMusicTracks(d.tracks || []))
      .catch(() => {})
  }, [])

  // ── Poll HeyGen ──────────────────────────────────────────────────
  useEffect(() => {
    if (step2.status !== 'loading' || !step2.videoId) return
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/video-status/heygen/${step2.videoId}`)
        const data = await res.json()
        if (data.status === 'succeeded') {
          setStep2(s => ({ ...s, status: 'done', videoUrl: data.video_url }))
        } else if (['failed', 'error'].includes(data.status)) {
          setStep2(s => ({ ...s, status: 'error', error: data.error || 'HeyGen generation failed' }))
        }
      } catch {}
    }
    const id = setInterval(poll, 5000)
    poll() // immediate first check
    return () => clearInterval(id)
  }, [step2.status, step2.videoId])

  // ── Poll Backgrounds ─────────────────────────────────────────────
  useEffect(() => {
    const pending = step3.backgrounds.filter(b => b.status === 'pending' && b.task_id)
    if (!pending.length) return

    const poll = async () => {
      for (const bg of pending) {
        try {
          const provider = bg.platform === 'runway' ? 'runway' : 'kling'
          const res = await fetch(`${API_BASE}/video-status/${provider}/${bg.task_id}`)
          const data = await res.json()
          if (data.status !== 'pending') {
            setStep3(s => ({
              ...s,
              backgrounds: s.backgrounds.map(b2 =>
                b2.task_id === bg.task_id
                  ? { ...b2, status: data.status, video_url: data.video_url, error: data.error }
                  : b2
              ),
            }))
          }
        } catch {}
      }
    }
    const id = setInterval(poll, 5000)
    poll()
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step3.backgrounds.filter(b => b.status === 'pending').map(b => b.task_id).join(',')])

  // ── Poll Composites ──────────────────────────────────────────────
  useEffect(() => {
    const pending = step4.composites.filter(c => c.status === 'pending' && c.render_id)
    if (!pending.length) return

    const poll = async () => {
      for (const comp of pending) {
        try {
          const res = await fetch(`${API_BASE}/pipeline/composite-status/${comp.render_id}`)
          const data = await res.json()
          if (data.status !== 'pending') {
            setStep4(s => ({
              ...s,
              composites: s.composites.map(c2 =>
                c2.render_id === comp.render_id
                  ? { ...c2, status: data.status, video_url: data.video_url, error: data.error }
                  : c2
              ),
            }))
          }
        } catch {}
      }
    }
    const id = setInterval(poll, 5000)
    poll()
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step4.composites.filter(c => c.status === 'pending').map(c => c.render_id).join(',')])

  // ── Step 2: Generate Avatar ──────────────────────────────────────
  async function handleGenerateAvatar(avatarId, voiceId, spokenScript) {
    setStep2({ ...INITIAL_STEP2, status: 'loading', hasGenerated: true })
    try {
      const res = await fetch(`${API_BASE}/heygen/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis,
          hashtags,
          avatar_id: avatarId,
          voice_id: voiceId,
          platform,
          spoken_script: spokenScript || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || `Server error ${res.status}`)
      }
      const data = await res.json()
      const video = data.videos[0]
      if (video.status === 'error') throw new Error(video.error || 'Submission failed')
      setStep2(s => ({
        ...s,
        videoId: video.task_id,
        spokenScript: video.spoken_script || '',
        status: 'loading',
      }))
    } catch (e) {
      setStep2(s => ({ ...s, status: 'error', error: e.message }))
    }
  }

  // ── Step 3: Generate Backgrounds ────────────────────────────────
  async function handleGenerateBackgrounds(promptA, promptB, model) {
    setStep3({ ...INITIAL_STEP3, status: 'loading', hasGenerated: true })
    try {
      const res = await fetch(`${API_BASE}/pipeline/generate-backgrounds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt_a: promptA, prompt_b: promptB, model }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || `Server error ${res.status}`)
      }
      const data = await res.json()
      setStep3(s => ({ ...s, backgrounds: data.backgrounds, status: 'loading' }))
    } catch (e) {
      setStep3(s => ({ ...s, status: 'error', error: e.message }))
    }
  }

  // ── Step 4: Composite ────────────────────────────────────────────
  async function handleComposite(slot) {
    const bg = step3.backgrounds.find(b => b.slot === slot && b.status === 'succeeded')
    if (!bg || !step2.videoUrl) return

    const hookText = analysis?.video_proposal?.hook || ''
    // Estimate spoken duration: ~2.5 words/sec (150 wpm)
    const wordCount = step2.spokenScript.split(/\s+/).filter(Boolean).length
    const duration = wordCount > 0 ? Math.max(15, Math.min(60, Math.ceil(wordCount / 2.5))) : 30

    // Mark slot as pending immediately
    setStep4(s => ({
      ...s,
      composites: [
        ...s.composites.filter(c => c.slot !== slot),
        { slot, render_id: null, status: 'loading', video_url: null, error: null },
      ],
    }))

    try {
      const res = await fetch(`${API_BASE}/pipeline/composite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          heygen_video_url: step2.videoUrl,
          background_video_url: bg.video_url,
          hook_text: hookText,
          music_track_id: step4.selectedMusic,
          duration,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || `Server error ${res.status}`)
      }
      const data = await res.json()
      setStep4(s => ({
        ...s,
        composites: s.composites.map(c =>
          c.slot === slot ? { ...c, render_id: data.render_id, status: 'pending' } : c
        ),
      }))
    } catch (e) {
      setStep4(s => ({
        ...s,
        composites: s.composites.map(c =>
          c.slot === slot ? { ...c, status: 'error', error: e.message } : c
        ),
      }))
    }
  }

  // ── Derived state ────────────────────────────────────────────────
  const step2Done = step2.status === 'done'
  const step3HasSuccess = step3.backgrounds.some(b => b.status === 'succeeded')
  const step4Unlocked = step2Done && step3HasSuccess

  function stepStatus(n) {
    if (n === 1) return 'done'
    if (n === 2) {
      if (step2.status === 'done') return 'done'
      if (step2.status === 'loading') return 'active'
      if (step2.status === 'error') return 'error'
      return 'idle'
    }
    if (n === 3) {
      if (step3HasSuccess) return 'done'
      if (step3.status === 'loading') return 'active'
      if (step3.status === 'error') return 'error'
      return 'idle'
    }
    if (n === 4) {
      if (step4.composites.some(c => c.status === 'succeeded')) return 'done'
      if (step4.composites.some(c => ['pending', 'loading'].includes(c.status))) return 'active'
      if (!step4Unlocked) return 'locked'
      return 'idle'
    }
  }

  return (
    <div className="pipeline-view">
      {/* Step progress bar */}
      <div className="pv-progress-bar">
        {[
          { n: 1, label: 'Script' },
          { n: 2, label: 'Avatar' },
          { n: 3, label: 'Backgrounds' },
          { n: 4, label: 'Final Video' },
        ].map(({ n, label }, i) => (
          <div key={n} className="pv-progress-item">
            <div className={`pv-progress-dot pv-dot-${stepStatus(n)}`}>
              {stepStatus(n) === 'done' ? '✓'
                : stepStatus(n) === 'active' ? '◌'
                : stepStatus(n) === 'locked' ? '🔒'
                : n}
            </div>
            <span className={`pv-progress-label pv-label-${stepStatus(n)}`}>{label}</span>
            {i < 3 && <div className={`pv-progress-line ${stepStatus(n) === 'done' ? 'pv-line-done' : ''}`} />}
          </div>
        ))}
      </div>

      {/* Step 1 */}
      <ScriptStep analysis={analysis} />

      {/* Step 2 */}
      <AvatarStep
        analysis={analysis}
        hashtags={hashtags}
        platform={platform}
        step2={step2}
        onGenerate={handleGenerateAvatar}
      />

      {/* Step 3 */}
      <BackgroundStep
        analysis={analysis}
        hashtags={hashtags}
        proposalsEndpoint={proposalsEndpoint}
        step3={step3}
        onGenerate={handleGenerateBackgrounds}
      />

      {/* Step 4 */}
      <CompositeStep
        step2={step2}
        step3={step3}
        step4={step4}
        musicTracks={musicTracks}
        unlocked={step4Unlocked}
        onSelectMusic={id => setStep4(s => ({ ...s, selectedMusic: id }))}
        onComposite={handleComposite}
      />
    </div>
  )
}
