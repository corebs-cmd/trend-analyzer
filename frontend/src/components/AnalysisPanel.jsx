import './AnalysisPanel.css'

function Section({ title, children }) {
  return (
    <div className="analysis-section">
      <h3 className="analysis-section-title">{title}</h3>
      {children}
    </div>
  )
}

export default function AnalysisPanel({ analysis }) {
  if (!analysis) return null

  const { trend_patterns, key_insights, video_proposal } = analysis
  const vp = video_proposal || {}
  const vs = vp.visual_style || {}

  return (
    <div className="analysis-panel">

      {/* Key Insights */}
      {key_insights && (
        <Section title="📊 Key Insights">
          <p className="key-insights">{key_insights}</p>
        </Section>
      )}

      {/* Trend Patterns */}
      {trend_patterns && trend_patterns.length > 0 && (
        <Section title="🔍 Trend Patterns">
          <div className="patterns-list">
            {trend_patterns.map((p, i) => (
              <div key={i} className="pattern-card">
                <div className="pattern-header">
                  <span className="pattern-name">{p.pattern}</span>
                  <span className="pattern-frequency">{p.frequency}</span>
                </div>
                <p className="pattern-desc">{p.description}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Video Proposal */}
      {vp.title && (
        <Section title="🎬 Proposed Video">
          <div className="video-proposal">

            <div className="vp-title-bar">
              <h4 className="vp-title">{vp.title}</h4>
            </div>

            {vp.hook && (
              <div className="vp-hook">
                <span className="vp-label">Hook (first 3 sec)</span>
                <blockquote className="vp-hook-text">"{vp.hook}"</blockquote>
              </div>
            )}

            {vp.content_structure && vp.content_structure.length > 0 && (
              <div className="vp-structure">
                <span className="vp-label">Content Structure</span>
                <div className="structure-list">
                  {vp.content_structure.map((s, i) => (
                    <div key={i} className="structure-item">
                      <div className="structure-meta">
                        <span className="structure-section">{s.section}</span>
                        <span className="structure-duration">{s.duration}</span>
                      </div>
                      <p className="structure-desc">{s.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {vs.aesthetic && (
              <div className="vp-visual">
                <span className="vp-label">Visual Style</span>
                <div className="visual-grid">
                  {vs.aesthetic && (
                    <div className="visual-item">
                      <span className="visual-key">Aesthetic</span>
                      <span className="visual-val">{vs.aesthetic}</span>
                    </div>
                  )}
                  {vs.lighting && (
                    <div className="visual-item">
                      <span className="visual-key">Lighting</span>
                      <span className="visual-val">{vs.lighting}</span>
                    </div>
                  )}
                  {vs.color_palette && (
                    <div className="visual-item">
                      <span className="visual-key">Color Palette</span>
                      <span className="visual-val">{vs.color_palette}</span>
                    </div>
                  )}
                  {vs.editing_style && (
                    <div className="visual-item">
                      <span className="visual-key">Editing</span>
                      <span className="visual-val">{vs.editing_style}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {vp.hashtag_recommendations && vp.hashtag_recommendations.length > 0 && (
              <div className="vp-hashtags">
                <span className="vp-label">Recommended Hashtags</span>
                <div className="hashtag-list">
                  {vp.hashtag_recommendations.map((tag, i) => (
                    <span key={i} className="hashtag-chip">
                      #{tag.replace(/^#/, '')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {vp.engagement_rationale && (
              <div className="vp-rationale">
                <span className="vp-label">Why This Will Perform</span>
                <p className="rationale-text">{vp.engagement_rationale}</p>
              </div>
            )}
          </div>
        </Section>
      )}
    </div>
  )
}
