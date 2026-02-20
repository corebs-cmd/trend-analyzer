import { useState } from 'react'
import './TikTokSearchForm.css'

export default function TikTokSearchForm({ onSearch, onReset, loading }) {
  const [hashtagInput, setHashtagInput] = useState('')
  const [resultsPerPage, setResultsPerPage] = useState(15)

  function handleSubmit(e) {
    e.preventDefault()
    const hashtags = hashtagInput
      .split(/[\s,]+/)
      .map(h => h.replace(/^#/, '').trim())
      .filter(Boolean)
    if (hashtags.length === 0) return
    onSearch({ hashtags, resultsPerPage })
  }

  return (
    <form className="search-form tt-search-form" onSubmit={handleSubmit}>
      {/* Hashtags full width */}
      <div className="form-group">
        <label htmlFor="tt-hashtags">Hashtags</label>
        <input
          id="tt-hashtags"
          type="text"
          placeholder="e.g. travel, fitness, dance"
          value={hashtagInput}
          onChange={e => setHashtagInput(e.target.value)}
          disabled={loading}
          required
        />
        <span className="form-hint">Comma or space separated. The # is optional.</span>
      </div>

      {/* Results per hashtag */}
      <div className="form-row-1">
        <div className="form-group">
          <label htmlFor="tt-results">Results per Hashtag</label>
          <input
            id="tt-results"
            type="number"
            min={1}
            max={50}
            value={resultsPerPage}
            onChange={e => setResultsPerPage(Number(e.target.value))}
            disabled={loading}
          />
          <span className="form-hint">1–50. Keep low to avoid timeout.</span>
        </div>
      </div>

      <div className="form-actions">
        <button
          type="submit"
          className="btn-primary btn-tiktok-primary"
          disabled={loading || !hashtagInput.trim()}
        >
          {loading ? 'Analyzing…' : 'Analyze Trends'}
        </button>
        {onReset && (
          <button type="button" className="btn-reset" onClick={onReset} disabled={loading}>
            Reset
          </button>
        )}
      </div>
    </form>
  )
}
