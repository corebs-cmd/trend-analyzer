import { useState } from 'react'
import SearchForm from './components/SearchForm'
import PostGrid from './components/PostGrid'
import AnalysisPanel from './components/AnalysisPanel'
import PromptProposal from './components/PromptProposal'
import VideoPanel from './components/VideoPanel'
import './App.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function App() {
  const [status, setStatus] = useState('idle') // idle | loading | done | error
  const [errorMsg, setErrorMsg] = useState('')
  const [posts, setPosts] = useState([])
  const [analysis, setAnalysis] = useState(null)
  const [lastQuery, setLastQuery] = useState(null)

  const [videoStatus, setVideoStatus] = useState('idle') // idle | loading | done | error
  const [videoError, setVideoError] = useState('')
  const [videos, setVideos] = useState([])
  const [selectedPrompt, setSelectedPrompt] = useState(null)
  const [hasGeneratedOnce, setHasGeneratedOnce] = useState(false)

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

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="logo-group">
            <span className="logo-icon">📸</span>
            <div>
              <h1 className="app-title">Instagram Trend Analyzer</h1>
              <p className="app-subtitle">Scrape hashtags · Analyze patterns · Get your next viral idea</p>
            </div>
          </div>
        </div>
      </header>

      <main className="app-main">
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

            {/* Prompt Proposals — always visible once results are shown */}
            <PromptProposal
              analysis={analysis}
              hashtags={lastQuery.hashtags}
              onPromptsReady={setSelectedPrompt}
            />

            {/* Generate / Regenerate Videos CTA */}
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
      </main>
    </div>
  )
}
