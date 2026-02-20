import { useState } from 'react'
import SearchForm from './components/SearchForm'
import TikTokSearchForm from './components/TikTokSearchForm'
import PostGrid from './components/PostGrid'
import AnalysisPanel from './components/AnalysisPanel'
import PromptProposal from './components/PromptProposal'
import VideoPanel from './components/VideoPanel'
import './App.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function App() {
  // ── Tab ──────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('instagram') // 'instagram' | 'tiktok'

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

                <div className="generate-video-bar">
                  <div className="gvb-text">
                    <p className="gvb-title">
                      {hasGeneratedOnce ? 'Try a different prompt?' : 'Ready to create actual video content?'}
                    </p>
                    <p className="gvb-sub">
                      Your selected prompt will be sent to all 5 AI video models simultaneously
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
                      ? '🔄 Regenerate Videos'
                      : '🎬 Generate AI Video'}
                  </button>
                </div>

                <VideoPanel
                  videos={videos}
                  loading={videoStatus === 'loading'}
                  error={videoStatus === 'error' ? videoError : null}
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

                <div className="generate-video-bar generate-video-bar--tiktok">
                  <div className="gvb-text">
                    <p className="gvb-title">
                      {ttHasGeneratedOnce ? 'Try a different prompt?' : 'Ready to create actual video content?'}
                    </p>
                    <p className="gvb-sub">
                      Your selected prompt will be sent to all 5 AI video models simultaneously
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
                      ? '🔄 Regenerate Videos'
                      : '🎬 Generate AI Video'}
                  </button>
                </div>

                <VideoPanel
                  videos={ttVideos}
                  loading={ttVideoStatus === 'loading'}
                  error={ttVideoStatus === 'error' ? ttVideoError : null}
                />
              </>
            )}
          </>
        )}

      </main>
    </div>
  )
}
