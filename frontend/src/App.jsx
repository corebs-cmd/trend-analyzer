import { useState, useEffect } from 'react'
import SearchForm from './components/SearchForm'
import TikTokSearchForm from './components/TikTokSearchForm'
import PostGrid from './components/PostGrid'
import AnalysisPanel from './components/AnalysisPanel'
import PromptProposal from './components/PromptProposal'
import VideoPanel from './components/VideoPanel'
import HeyGenPanel from './components/HeyGenPanel'
import './App.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const SESSION_TTL = 24 * 60 * 60 * 1000 // 24 hours

function saveSession(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ ...data, savedAt: Date.now() })) } catch {}
}
function loadSession(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const d = JSON.parse(raw)
    if (Date.now() - d.savedAt > SESSION_TTL) { localStorage.removeItem(key); return null }
    return d
  } catch { return null }
}
function clearSession(key) {
  try { localStorage.removeItem(key) } catch {}
}
function formatAge(ts) {
  const mins = Math.round((Date.now() - ts) / 60000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  return hrs === 1 ? '1 hour ago' : `${hrs} hours ago`
}

export default function App() {
  // ── Tab ──────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('instagram') // 'instagram' | 'tiktok'

  // ── Session restore timestamps ────────────────────────────────────
  const [igRestoredAt, setIgRestoredAt] = useState(null)
  const [ttRestoredAt, setTtRestoredAt] = useState(null)

  // ── Instagram state (unchanged) ──────────────────────────────────
  const [status, setStatus] = useState('idle') // idle | loading | done | error
  const [errorMsg, setErrorMsg] = useState('')
  const [posts, setPosts] = useState([])
  const [analysis, setAnalysis] = useState(null)
  const [lastQuery, setLastQuery] = useState(null)
  const [videoStatus, setVideoStatus] = useState('idle')
  const [videoError, setVideoError] = useState('')
  const [videos, setVideos] = useState([])
  const [selectedPrompt, setSelectedPrompt] = useState(null)
  const [hasGeneratedOnce, setHasGeneratedOnce] = useState(false)

  // ── Instagram HeyGen state ────────────────────────────────────────
  const [hgVideoStatus, setHgVideoStatus] = useState('idle')
  const [hgVideoError, setHgVideoError] = useState('')
  const [hgVideos, setHgVideos] = useState([])
  const [hgHasGeneratedOnce, setHgHasGeneratedOnce] = useState(false)

  // ── TikTok state (parallel, independent) ─────────────────────────
  const [ttStatus, setTtStatus] = useState('idle')
  const [ttErrorMsg, setTtErrorMsg] = useState('')
  const [ttPosts, setTtPosts] = useState([])
  const [ttAnalysis, setTtAnalysis] = useState(null)
  const [ttLastQuery, setTtLastQuery] = useState(null)
  const [ttVideoStatus, setTtVideoStatus] = useState('idle')
  const [ttVideoError, setTtVideoError] = useState('')
  const [ttVideos, setTtVideos] = useState([])
  const [ttSelectedPrompt, setTtSelectedPrompt] = useState(null)
  const [ttHasGeneratedOnce, setTtHasGeneratedOnce] = useState(false)

  // ── TikTok HeyGen state ───────────────────────────────────────────
  const [ttHgVideoStatus, setTtHgVideoStatus] = useState('idle')
  const [ttHgVideoError, setTtHgVideoError] = useState('')
  const [ttHgVideos, setTtHgVideos] = useState([])
  const [ttHgHasGeneratedOnce, setTtHgHasGeneratedOnce] = useState(false)

  // ── Restore sessions from localStorage on mount ──────────────────
  useEffect(() => {
    const ig = loadSession('soc_ig')
    if (ig) {
      setPosts(ig.posts || [])
      setAnalysis(ig.analysis)
      setLastQuery(ig.lastQuery)
      setStatus('done')
      setIgRestoredAt(ig.savedAt)
    }
    const tt = loadSession('soc_tt')
    if (tt) {
      setTtPosts(tt.posts || [])
      setTtAnalysis(tt.analysis)
      setTtLastQuery(tt.lastQuery)
      setTtStatus('done')
      setTtRestoredAt(tt.savedAt)
    }
  }, [])

  // ── Instagram handlers (unchanged) ───────────────────────────────
  function handleReset() {
    setStatus('idle')
    setErrorMsg('')
    setPosts([])
    setAnalysis(null)
    setLastQuery(null)
    setVideoStatus('idle')
    setVideos([])
    setVideoError('')
    setSelectedPrompt(null)
    setHasGeneratedOnce(false)
    setHgVideoStatus('idle')
    setHgVideos([])
    setHgVideoError('')
    setHgHasGeneratedOnce(false)
    setIgRestoredAt(null)
    clearSession('soc_ig')
  }

  async function handleSearch({ hashtags, minLikes, maxPosts, contentTypes }) {
    setStatus('loading')
    setErrorMsg('')
    setPosts([])
    setAnalysis(null)
    setLastQuery({ hashtags, minLikes, maxPosts, contentTypes })
    setVideoStatus('idle')
    setVideos([])
    setVideoError('')
    setSelectedPrompt(null)
    setHasGeneratedOnce(false)
    setHgVideoStatus('idle')
    setHgVideos([])
    setHgVideoError('')
    setHgHasGeneratedOnce(false)

    try {
      const res = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hashtags,
          min_likes: minLikes,
          max_posts: maxPosts,
          content_types: contentTypes,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || `Server error ${res.status}`)
      }

      const data = await res.json()
      setPosts(data.posts)
      setAnalysis(data.analysis)
      setStatus('done')
      setIgRestoredAt(null)
      saveSession('soc_ig', {
        posts: data.posts,
        analysis: data.analysis,
        lastQuery: { hashtags, minLikes, maxPosts, contentTypes },
      })
    } catch (e) {
      setErrorMsg(e.message)
      setStatus('error')
    }
  }

  async function handleGenerateVideos() {
    if (!analysis || !lastQuery) return
    setVideoStatus('loading')
    setVideoError('')
    setVideos([])

    try {
      const res = await fetch(`${API_BASE}/generate-videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis,
          hashtags: lastQuery.hashtags,
          selected_prompt: selectedPrompt || undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || `Server error ${res.status}`)
      }

      const data = await res.json()
      setVideos(data.videos)
      setVideoStatus('done')
      setHasGeneratedOnce(true)
    } catch (e) {
      setVideoError(e.message)
      setVideoStatus('error')
    }
  }

  async function handleGenerateHeyGen(avatarId, voiceId) {
    if (!analysis || !lastQuery) return
    setHgVideoStatus('loading')
    setHgVideoError('')
    setHgVideos([])

    try {
      const res = await fetch(`${API_BASE}/heygen/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis,
          hashtags: lastQuery.hashtags,
          avatar_id: avatarId,
          voice_id: voiceId,
          platform: 'instagram',
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || `Server error ${res.status}`)
      }

      const data = await res.json()
      setHgVideos(data.videos)
      setHgVideoStatus('done')
      setHgHasGeneratedOnce(true)
    } catch (e) {
      setHgVideoError(e.message)
      setHgVideoStatus('error')
    }
  }

  // ── TikTok handlers ───────────────────────────────────────────────
  function handleTikTokReset() {
    setTtStatus('idle')
    setTtErrorMsg('')
    setTtPosts([])
    setTtAnalysis(null)
    setTtLastQuery(null)
    setTtVideoStatus('idle')
    setTtVideos([])
    setTtVideoError('')
    setTtSelectedPrompt(null)
    setTtHasGeneratedOnce(false)
    setTtHgVideoStatus('idle')
    setTtHgVideos([])
    setTtHgVideoError('')
    setTtHgHasGeneratedOnce(false)
    setTtRestoredAt(null)
    clearSession('soc_tt')
  }

  async function handleTikTokSearch({ hashtags, resultsPerPage }) {
    setTtStatus('loading')
    setTtErrorMsg('')
    setTtPosts([])
    setTtAnalysis(null)
    setTtLastQuery({ hashtags, resultsPerPage })
    setTtVideoStatus('idle')
    setTtVideos([])
    setTtVideoError('')
    setTtSelectedPrompt(null)
    setTtHasGeneratedOnce(false)
    setTtHgVideoStatus('idle')
    setTtHgVideos([])
    setTtHgVideoError('')
    setTtHgHasGeneratedOnce(false)

    try {
      const res = await fetch(`${API_BASE}/tiktok/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hashtags,
          results_per_page: resultsPerPage,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || `Server error ${res.status}`)
      }

      const data = await res.json()
      setTtPosts(data.posts)
      setTtAnalysis(data.analysis)
      setTtStatus('done')
      setTtRestoredAt(null)
      saveSession('soc_tt', {
        posts: data.posts,
        analysis: data.analysis,
        lastQuery: { hashtags, resultsPerPage },
      })
    } catch (e) {
      setTtErrorMsg(e.message)
      setTtStatus('error')
    }
  }

  async function handleTikTokGenerateVideos() {
    if (!ttAnalysis || !ttLastQuery) return
    setTtVideoStatus('loading')
    setTtVideoError('')
    setTtVideos([])

    try {
      const res = await fetch(`${API_BASE}/tiktok/generate-videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis: ttAnalysis,
          hashtags: ttLastQuery.hashtags,
          selected_prompt: ttSelectedPrompt || undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || `Server error ${res.status}`)
      }

      const data = await res.json()
      setTtVideos(data.videos)
      setTtVideoStatus('done')
      setTtHasGeneratedOnce(true)
    } catch (e) {
      setTtVideoError(e.message)
      setTtVideoStatus('error')
    }
  }

  async function handleTikTokGenerateHeyGen(avatarId, voiceId) {
    if (!ttAnalysis || !ttLastQuery) return
    setTtHgVideoStatus('loading')
    setTtHgVideoError('')
    setTtHgVideos([])

    try {
      const res = await fetch(`${API_BASE}/heygen/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis: ttAnalysis,
          hashtags: ttLastQuery.hashtags,
          avatar_id: avatarId,
          voice_id: voiceId,
          platform: 'tiktok',
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || `Server error ${res.status}`)
      }

      const data = await res.json()
      setTtHgVideos(data.videos)
      setTtHgVideoStatus('done')
      setTtHgHasGeneratedOnce(true)
    } catch (e) {
      setTtHgVideoError(e.message)
      setTtHgVideoStatus('error')
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="logo-group">
            <span className="logo-icon">{activeTab === 'tiktok' ? '🎵' : '📸'}</span>
            <div>
              <h1 className="app-title">Social Trend Analyzer</h1>
              <p className="app-subtitle">Scrape hashtags · Analyze patterns · Get your next viral idea</p>
            </div>
          </div>

          {/* Tab Bar */}
          <div className="tab-bar">
            <button
              className={`tab-btn tab-instagram ${activeTab === 'instagram' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('instagram')}
            >
              📸 Instagram
            </button>
            <button
              className={`tab-btn tab-tiktok ${activeTab === 'tiktok' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('tiktok')}
            >
              🎵 TikTok
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">

        {/* ── INSTAGRAM TAB (content unchanged) ── */}
        {activeTab === 'instagram' && (
          <>
            <SearchForm onSearch={handleSearch} onReset={status !== 'idle' ? handleReset : null} loading={status === 'loading'} />

            {status === 'loading' && (
              <div className="status-box loading-box">
                <div className="spinner" />
                <div>
                  <p className="status-title">Scraping Instagram & analyzing…</p>
                  <p className="status-sub">This can take 30–90 seconds. Hang tight!</p>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="status-box error-box">
                <span className="status-icon">⚠️</span>
                <div>
                  <p className="status-title">Something went wrong</p>
                  <p className="status-sub">{errorMsg}</p>
                </div>
              </div>
            )}

            {status === 'done' && (
              <>
                {igRestoredAt && (
                  <div className="session-restored-banner">
                    <span>📦 Restored from last session ({formatAge(igRestoredAt)}) · No scraping credits used</span>
                    <button className="srb-dismiss" onClick={handleReset}>✕ Clear &amp; start fresh</button>
                  </div>
                )}
                <div className="results-layout">
                  <section className="results-left">
                    <div className="section-header">
                      <h2>Posts Found</h2>
                      <span className="badge">{posts.length} posts</span>
                      {lastQuery && (
                        <span className="badge badge-secondary">
                          #{lastQuery.hashtags.join(' #')} · {lastQuery.contentTypes.join(' + ')}
                        </span>
                      )}
                    </div>
                    <PostGrid posts={posts} />
                  </section>

                  <section className="results-right">
                    <div className="section-header">
                      <h2>AI Analysis & Video Proposal</h2>
                      <span className="badge badge-ai">Claude</span>
                    </div>
                    <AnalysisPanel analysis={analysis} />
                  </section>
                </div>

                <PromptProposal
                  analysis={analysis}
                  hashtags={lastQuery.hashtags}
                  onPromptsReady={setSelectedPrompt}
                />

                {/* ── Cinematic Video Section ── */}
                <div className="generate-video-bar">
                  <div className="gvb-text">
                    <p className="gvb-title">🎬 Cinematic AI Video</p>
                    <p className="gvb-sub">
                      {hasGeneratedOnce
                        ? 'Try a different prompt to get new cinematic results'
                        : 'Your selected prompt renders across RunwayML · Kling · Pika · Luma · Hailuo simultaneously'}
                    </p>
                  </div>
                  <button
                    className="btn-generate-video"
                    onClick={handleGenerateVideos}
                    disabled={!selectedPrompt || videoStatus === 'loading'}
                  >
                    {videoStatus === 'loading'
                      ? '⏳ Generating…'
                      : hasGeneratedOnce
                      ? '🔄 Regenerate Cinematic Videos'
                      : '🎬 Generate Cinematic Videos'}
                  </button>
                </div>

                <VideoPanel
                  videos={videos}
                  loading={videoStatus === 'loading'}
                  error={videoStatus === 'error' ? videoError : null}
                  title="🎬 Cinematic AI Video — Results"
                  subtitle={
                    videos.length > 0 && videos.every(v =>
                      ['succeeded','failed','error','cancelled'].includes(v.status?.toLowerCase())
                    )
                      ? `${videos.filter(v => v.status?.toLowerCase() === 'succeeded').length} of ${videos.length} rendered · Same concept, different models — pick your favourite`
                      : 'Rendering… updates automatically'
                  }
                />

                {/* ── HeyGen Avatar Section ── */}
                <HeyGenPanel
                  analysis={analysis}
                  hashtags={lastQuery.hashtags}
                  onGenerate={handleGenerateHeyGen}
                  loading={hgVideoStatus === 'loading'}
                  hasGeneratedOnce={hgHasGeneratedOnce}
                />

                <VideoPanel
                  videos={hgVideos}
                  loading={hgVideoStatus === 'loading'}
                  error={hgVideoStatus === 'error' ? hgVideoError : null}
                  title="🎭 HeyGen Avatar IV — Result"
                  subtitle="Your AI avatar video — reviewing & processing by HeyGen"
                />
              </>
            )}
          </>
        )}

        {/* ── TIKTOK TAB ── */}
        {activeTab === 'tiktok' && (
          <>
            <TikTokSearchForm
              onSearch={handleTikTokSearch}
              onReset={ttStatus !== 'idle' ? handleTikTokReset : null}
              loading={ttStatus === 'loading'}
            />

            {ttStatus === 'loading' && (
              <div className="status-box loading-box">
                <div className="spinner" />
                <div>
                  <p className="status-title">Scraping TikTok & analyzing…</p>
                  <p className="status-sub">This can take 30–90 seconds. Hang tight!</p>
                </div>
              </div>
            )}

            {ttStatus === 'error' && (
              <div className="status-box error-box">
                <span className="status-icon">⚠️</span>
                <div>
                  <p className="status-title">Something went wrong</p>
                  <p className="status-sub">{ttErrorMsg}</p>
                </div>
              </div>
            )}

            {ttStatus === 'done' && (
              <>
                {ttRestoredAt && (
                  <div className="session-restored-banner session-restored-banner--tiktok">
                    <span>📦 Restored from last session ({formatAge(ttRestoredAt)}) · No scraping credits used</span>
                    <button className="srb-dismiss" onClick={handleTikTokReset}>✕ Clear &amp; start fresh</button>
                  </div>
                )}
                <div className="results-layout">
                  <section className="results-left">
                    <div className="section-header">
                      <h2>Videos Found</h2>
                      <span className="badge">{ttPosts.length} videos</span>
                      {ttLastQuery && (
                        <span className="badge badge-secondary">
                          #{ttLastQuery.hashtags.join(' #')}
                        </span>
                      )}
                    </div>
                    <PostGrid posts={ttPosts} />
                  </section>

                  <section className="results-right">
                    <div className="section-header">
                      <h2>AI Analysis & Video Proposal</h2>
                      <span className="badge badge-ai">Claude</span>
                    </div>
                    <AnalysisPanel analysis={ttAnalysis} />
                  </section>
                </div>

                <PromptProposal
                  analysis={ttAnalysis}
                  hashtags={ttLastQuery.hashtags}
                  onPromptsReady={setTtSelectedPrompt}
                  proposalsEndpoint="/tiktok/propose-prompts"
                />

                {/* ── Cinematic Video Section ── */}
                <div className="generate-video-bar generate-video-bar--tiktok">
                  <div className="gvb-text">
                    <p className="gvb-title">🎬 Cinematic AI Video</p>
                    <p className="gvb-sub">
                      {ttHasGeneratedOnce
                        ? 'Try a different prompt to get new cinematic results'
                        : 'Your selected prompt renders across RunwayML · Kling · Pika · Luma · Hailuo simultaneously'}
                    </p>
                  </div>
                  <button
                    className="btn-generate-video btn-generate-video--tiktok"
                    onClick={handleTikTokGenerateVideos}
                    disabled={!ttSelectedPrompt || ttVideoStatus === 'loading'}
                  >
                    {ttVideoStatus === 'loading'
                      ? '⏳ Generating…'
                      : ttHasGeneratedOnce
                      ? '🔄 Regenerate Cinematic Videos'
                      : '🎬 Generate Cinematic Videos'}
                  </button>
                </div>

                <VideoPanel
                  videos={ttVideos}
                  loading={ttVideoStatus === 'loading'}
                  error={ttVideoStatus === 'error' ? ttVideoError : null}
                  title="🎬 Cinematic AI Video — Results"
                  subtitle={
                    ttVideos.length > 0 && ttVideos.every(v =>
                      ['succeeded','failed','error','cancelled'].includes(v.status?.toLowerCase())
                    )
                      ? `${ttVideos.filter(v => v.status?.toLowerCase() === 'succeeded').length} of ${ttVideos.length} rendered · Same concept, different models — pick your favourite`
                      : 'Rendering… updates automatically'
                  }
                />

                {/* ── HeyGen Avatar Section ── */}
                <HeyGenPanel
                  analysis={ttAnalysis}
                  hashtags={ttLastQuery.hashtags}
                  onGenerate={handleTikTokGenerateHeyGen}
                  loading={ttHgVideoStatus === 'loading'}
                  hasGeneratedOnce={ttHgHasGeneratedOnce}
                />

                <VideoPanel
                  videos={ttHgVideos}
                  loading={ttHgVideoStatus === 'loading'}
                  error={ttHgVideoStatus === 'error' ? ttHgVideoError : null}
                  title="🎭 HeyGen Avatar IV — Result"
                  subtitle="Your AI avatar video — reviewing & processing by HeyGen"
                />
              </>
            )}
          </>
        )}

      </main>
    </div>
  )
}
