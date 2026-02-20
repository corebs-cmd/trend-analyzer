import { useState, useEffect } from 'react'
import './PromptProposal.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function PromptProposal({ analysis, hashtags, onPromptsReady, proposalsEndpoint = '/propose-prompts' }) {
  const [proposals, setProposals] = useState([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!analysis || !hashtags) return
    fetchProposals()
  }, [analysis, hashtags])

  async function fetchProposals() {
    setLoading(true)
    setError('')
    setProposals([])
    try {
      const res = await fetch(`${API_BASE}${proposalsEndpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis, hashtags }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || `Server error ${res.status}`)
      }
      const data = await res.json()
      setProposals(data.proposals)
      setSelectedIndex(0)
      onPromptsReady(data.proposals[0].prompt)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function handleSelect(index) {
    setSelectedIndex(index)
    onPromptsReady(proposals[index].prompt)
  }

  if (loading) {
    return (
      <div className="prompt-proposal-loading">
        <div className="pp-spinner" />
        <p>Claude is crafting 3 optimized prompt variations…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="prompt-proposal-error">
        <span>⚠️</span>
        <p>Failed to generate prompts: {error}</p>
        <button className="pp-retry" onClick={fetchProposals}>Retry</button>
      </div>
    )
  }

  if (!proposals.length) return null

  return (
    <div className="prompt-proposal">
      <div className="pp-header">
        <h2>✨ Proposed Prompts</h2>
        <p className="pp-sub">Claude generated 3 optimized video prompts based on the trend analysis. Select the one that best fits your vision.</p>
      </div>

      <div className="pp-options">
        {proposals.map((p, i) => (
          <label
            key={i}
            className={`pp-option ${selectedIndex === i ? 'pp-option--selected' : ''}`}
            onClick={() => handleSelect(i)}
          >
            <div className="pp-option-top">
              <input
                type="radio"
                name="prompt-selection"
                checked={selectedIndex === i}
                onChange={() => handleSelect(i)}
                className="pp-radio"
              />
              <div className="pp-option-meta">
                <span className="pp-label">{p.label}</span>
                <span className="pp-description">{p.description}</span>
              </div>
            </div>
            <p className="pp-prompt-text">{p.prompt}</p>
          </label>
        ))}
      </div>
    </div>
  )
}
