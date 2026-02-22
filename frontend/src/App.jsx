import { useState, useEffect } from 'react'

// ── Platform logo SVGs ────────────────────────────────────────────────
function InstagramIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id="ig-grad" cx="30%" cy="107%" r="150%">
          <stop offset="0%"   stopColor="#fdf497" />
          <stop offset="5%"   stopColor="#fdf497" />
          <stop offset="45%"  stopColor="#fd5949" />
          <stop offset="60%"  stopColor="#d6249f" />
          <stop offset="90%"  stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#ig-grad)" />
      <circle cx="12" cy="12" r="4.5" stroke="white" strokeWidth="2.2" fill="none" />
      <circle cx="17.5" cy="6.5" r="1.45" fill="white" />
    </svg>
  )
}

function TikTokIcon({ size = 24 }) {
  // The TikTok "d-note" shape, offset-cloned for the characteristic red+cyan shadow
  const d = 'M17.5 4.2A4.6 4.6 0 0 1 13.8 0H10.4v14.5a2.85 2.85 0 1 1-2.05-2.73V8.3A6.73 6.73 0 1 0 14.35 15V7.95a8.4 8.4 0 0 0 4.65 1.4V6a4.65 4.65 0 0 1-1.5-.3z'
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="5" fill="#010101" />
      {/* red shadow */}
      <path d={d} fill="#fe2c55" transform="translate(3.3 2.5) scale(0.78) translate( 0.6 0)" />
      {/* cyan shadow */}
      <path d={d} fill="#25f4ee" transform="translate(3.3 2.5) scale(0.78) translate(-0.6 0)" />
      {/* white center */}
      <path d={d} fill="white"   transform="translate(3.3 2.5) scale(0.78)" />
    </svg>
  )
}
import SearchForm from './components/SearchForm'
import TikTokSearchForm from './components/TikTokSearchForm'
import PostGrid from './components/PostGrid'
import AnalysisPanel from './components/AnalysisPanel'
import PipelineView from './components/PipelineView'
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
  const [activeTab, setActiveTab] = useState('tiktok')

  // ── Session restore timestamps ───────────────────────────────────
  const [igRestoredAt, setIgRestoredAt] = useState(null)
  const [ttRestoredAt, setTtRestoredAt] = useState(null)

  // ── Instagram state ──────────────────────────────────────────────
  const [status, setStatus] = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [posts, setPosts] = useState([])
  const [analysis, setAnalysis] = useState(null)
  const [lastQuery, setLastQuery] = useState(null)

  // ── TikTok state ─────────────────────────────────────────────────
  const [ttStatus, setTtStatus] = useState('idle')
  const [ttErrorMsg, setTtErrorMsg] = useState('')
  const [ttPosts, setTtPosts] = useState([])
  const [ttAnalysis, setTtAnalysis] = useState(null)
  const [ttLastQuery, setTtLastQuery] = useState(null)

  // ── Restore sessions on mount ────────────────────────────────────
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

  // ── Instagram handlers ───────────────────────────────────────────
  function handleReset() {
    setStatus('idle'); setErrorMsg(''); setPosts([]); setAnalysis(null)
    setLastQuery(null); setIgRestoredAt(null); clearSession('soc_ig')
  }

  async function handleSearch({ hashtags, minLikes, maxPosts, contentTypes }) {
    setStatus('loading'); setErrorMsg(''); setPosts([]); setAnalysis(null)
    setLastQuery({ hashtags, minLikes, maxPosts, contentTypes })
    try {
      const res = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hashtags, min_likes: minLikes, max_posts: maxPosts, content_types: contentTypes }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail || `Server error ${res.status}`) }
      const data = await res.json()
      setPosts(data.posts); setAnalysis(data.analysis); setStatus('done'); setIgRestoredAt(null)
      saveSession('soc_ig', { posts: data.posts, analysis: data.analysis, lastQuery: { hashtags, minLikes, maxPosts, contentTypes } })
    } catch (e) { setErrorMsg(e.message); setStatus('error') }
  }

  // ── TikTok handlers ──────────────────────────────────────────────
  function handleTikTokReset() {
    setTtStatus('idle'); setTtErrorMsg(''); setTtPosts([]); setTtAnalysis(null)
    setTtLastQuery(null); setTtRestoredAt(null); clearSession('soc_tt')
  }

  async function handleTikTokSearch({ hashtags, resultsPerPage }) {
    setTtStatus('loading'); setTtErrorMsg(''); setTtPosts([]); setTtAnalysis(null)
    setTtLastQuery({ hashtags, resultsPerPage })
    try {
      const res = await fetch(`${API_BASE}/tiktok/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hashtags, results_per_page: resultsPerPage }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail || `Server error ${res.status}`) }
      const data = await res.json()
      setTtPosts(data.posts); setTtAnalysis(data.analysis); setTtStatus('done'); setTtRestoredAt(null)
      saveSession('soc_tt', { posts: data.posts, analysis: data.analysis, lastQuery: { hashtags, resultsPerPage } })
    } catch (e) { setTtErrorMsg(e.message); setTtStatus('error') }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="logo-group">
            <span className="logo-icon">
              {activeTab === 'tiktok' ? <TikTokIcon size={40} /> : <InstagramIcon size={40} />}
            </span>
            <div>
              <h1 className="app-title">Social Trend Analyzer</h1>
              <p className="app-subtitle">Scrape hashtags · Analyze patterns · Generate postable videos</p>
            </div>
          </div>
          <div className="tab-bar">
            <button className={`tab-btn tab-instagram ${activeTab === 'instagram' ? 'tab-active' : ''}`} onClick={() => setActiveTab('instagram')}>
              <InstagramIcon size={20} /> Instagram
            </button>
            <button className={`tab-btn tab-tiktok ${activeTab === 'tiktok' ? 'tab-active' : ''}`} onClick={() => setActiveTab('tiktok')}>
              <TikTokIcon size={20} /> TikTok
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">

        {/* ── INSTAGRAM TAB ── */}
        {activeTab === 'instagram' && (
          <>
            <SearchForm onSearch={handleSearch} onReset={status !== 'idle' ? handleReset : null} loading={status === 'loading'} />

            {status === 'loading' && (
              <div className="status-box loading-box">
                <div className="spinner" />
                <div>
                  <p className="status-title">Scraping Instagram &amp; analyzing…</p>
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
                          #{lastQuery.hashtags.join(' #')} · {lastQuery.contentTypes?.join(' + ')}
                        </span>
                      )}
                    </div>
                    <PostGrid posts={posts} />
                  </section>
                  <section className="results-right">
                    <div className="section-header">
                      <h2>AI Analysis &amp; Video Proposal</h2>
                      <span className="badge badge-ai">Claude</span>
                    </div>
                    <AnalysisPanel analysis={analysis} />
                  </section>
                </div>

                {/* ── Video Production Pipeline ── */}
                <PipelineView
                  analysis={analysis}
                  hashtags={lastQuery.hashtags}
                  platform="instagram"
                />
              </>
            )}
          </>
        )}

        {/* ── TIKTOK TAB ── */}
        {activeTab === 'tiktok' && (
          <>
            <TikTokSearchForm onSearch={handleTikTokSearch} onReset={ttStatus !== 'idle' ? handleTikTokReset : null} loading={ttStatus === 'loading'} />

            {ttStatus === 'loading' && (
              <div className="status-box loading-box">
                <div className="spinner" />
                <div>
                  <p className="status-title">Scraping TikTok &amp; analyzing…</p>
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
                        <span className="badge badge-secondary">#{ttLastQuery.hashtags.join(' #')}</span>
                      )}
                    </div>
                    <PostGrid posts={ttPosts} />
                  </section>
                  <section className="results-right">
                    <div className="section-header">
                      <h2>AI Analysis &amp; Video Proposal</h2>
                      <span className="badge badge-ai">Claude</span>
                    </div>
                    <AnalysisPanel analysis={ttAnalysis} />
                  </section>
                </div>

                {/* ── Video Production Pipeline ── */}
                <PipelineView
                  analysis={ttAnalysis}
                  hashtags={ttLastQuery.hashtags}
                  platform="tiktok"
                />
              </>
            )}
          </>
        )}

      </main>
    </div>
  )
}
