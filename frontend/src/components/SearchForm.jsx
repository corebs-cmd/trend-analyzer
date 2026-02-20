import { useState } from 'react'
import './SearchForm.css'

const TYPE_OPTIONS = [
  { value: 'posts', label: '📷 Posts' },
  { value: 'reels', label: '🎥 Reels' },
]

export default function SearchForm({ onSearch, onReset, loading }) {
  const [hashtagInput, setHashtagInput] = useState('')
  const [minLikes, setMinLikes] = useState(0)
  const [maxPosts, setMaxPosts] = useState(50)
  const [contentTypes, setContentTypes] = useState(['posts', 'reels'])

  function toggleType(value) {
    setContentTypes(prev =>
      prev.includes(value)
        ? prev.filter(t => t !== value)
        : [...prev, value]
    )
  }

  function handleSubmit(e) {
    e.preventDefault()
    const hashtags = hashtagInput
      .split(/[\s,]+/)
      .map(h => h.replace(/^#/, '').trim())
      .filter(Boolean)
    if (hashtags.length === 0 || contentTypes.length === 0) return
    onSearch({ hashtags, minLikes, maxPosts, contentTypes })
  }

  return (
    <form className="search-form" onSubmit={handleSubmit}>
      {/* Row 1: Hashtags full width */}
      <div className="form-group">
        <label htmlFor="hashtags">Hashtags</label>
        <input
          id="hashtags"
          type="text"
          placeholder="e.g. travel, fitness, photography"
          value={hashtagInput}
          onChange={e => setHashtagInput(e.target.value)}
          disabled={loading}
          required
        />
        <span className="form-hint">Comma or space separated. The # is optional.</span>
      </div>

      {/* Row 2: Content Type · Max Posts · Min Likes */}
      <div className="form-row-3">
        <div className="form-group">
          <label>Content Type</label>
          <div className="type-toggle-group">
            {TYPE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                className={`type-toggle ${contentTypes.includes(opt.value) ? 'active' : ''}`}
                onClick={() => toggleType(opt.value)}
                disabled={loading}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {contentTypes.length === 0 && (
            <span className="form-hint form-hint-error">Select at least one type.</span>
          )}
          {contentTypes.length === 2 && (
            <span className="form-hint">Both selected — runs 2 scrapes.</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="maxPosts">Max Posts per Type</label>
          <input
            id="maxPosts"
            type="number"
            min={1}
            max={200}
            value={maxPosts}
            onChange={e => setMaxPosts(Number(e.target.value))}
            disabled={loading}
          />
          <span className="form-hint">1–200 per type.</span>
        </div>

        <div className="form-group">
          <label htmlFor="minLikes">Min Likes</label>
          <input
            id="minLikes"
            type="number"
            min={0}
            value={minLikes}
            onChange={e => setMinLikes(Number(e.target.value))}
            disabled={loading}
          />
          <span className="form-hint">⚠️ Most posts show 0 — keep at 0.</span>
        </div>
      </div>

      <div className="form-actions">
        <button
          type="submit"
          className="btn-primary"
          disabled={loading || !hashtagInput.trim() || contentTypes.length === 0}
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
