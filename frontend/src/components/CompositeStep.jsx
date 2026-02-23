import './CompositeStep.css'

export default function CompositeStep({
  step2,
  step3,
  step4,
  musicTracks,
  unlocked,
  onSelectMusic,
  captionsEnabled,
  onToggleCaptions,
  onComposite,
}) {
  const succeededBgs = step3.backgrounds.filter(b => b.status === 'succeeded')
  const canCompositeA = step2.status === 'done' && succeededBgs.some(b => b.slot === 'A')
  const canCompositeB = step2.status === 'done' && succeededBgs.some(b => b.slot === 'B')

  const compositeForSlot = (slot) => step4.composites.find(c => c.slot === slot)

  const anyDone = step4.composites.some(c => c.status === 'succeeded')

  return (
    <div className={`composite-step ${!unlocked ? 'composite-locked' : ''}`}>
      <div className="cs-header">
        <div className="cs-step-badge">STEP 4</div>
        <h3 className="cs-title">Final Composite Video</h3>
        <span className="cs-model-tag">Shotstack</span>
        {!unlocked && <span className="cs-locked-badge">🔒 Waiting for Steps 2 &amp; 3</span>}
        {anyDone && <span className="cs-status-done">✅ Ready</span>}
      </div>

      {!unlocked ? (
        <div className="cs-locked-body">
          <p>Complete the Avatar (Step 2) and at least one Background (Step 3) to unlock compositing.</p>
          <div className="cs-lock-checklist">
            <div className={`cs-check ${step2.status === 'done' ? 'cs-check-done' : ''}`}>
              {step2.status === 'done' ? '✅' : '○'} Avatar video rendered
            </div>
            <div className={`cs-check ${succeededBgs.length > 0 ? 'cs-check-done' : ''}`}>
              {succeededBgs.length > 0 ? '✅' : '○'} At least 1 background rendered
            </div>
          </div>
        </div>
      ) : (
        <div className="cs-body">
          {/* Music selector */}
          <div className="cs-section">
            <span className="cs-label">Background Music</span>
            <div className="cs-music-row">
              {musicTracks.map(t => (
                <button
                  key={t.id}
                  className={`cs-music-btn ${step4.selectedMusic === t.id ? 'cs-music-selected' : ''}`}
                  onClick={() => onSelectMusic(t.id)}
                >
                  {t.name}
                </button>
              ))}
            </div>
            <p className="cs-music-note">Music plays at low volume behind the avatar's voice</p>
          </div>

          {/* Captions toggle */}
          <div className="cs-section">
            <span className="cs-label">Captions</span>
            <button
              className={`cs-caption-toggle ${captionsEnabled ? 'cs-caption-on' : ''}`}
              onClick={onToggleCaptions}
            >
              💬 Captions {captionsEnabled ? 'On' : 'Off'}
            </button>
            <p className="cs-caption-note">
              {captionsEnabled
                ? 'Script split into timed subtitle chunks across the video'
                : 'Hook text shown for 3.5s at the start (default)'}
            </p>
          </div>

          {/* Composite actions */}
          <div className="cs-section">
            <span className="cs-label">Generate Final Videos</span>
            <div className="cs-compose-row">
              {/* Slot A */}
              {(() => {
                const comp = compositeForSlot('A')
                const bgA = succeededBgs.find(b => b.slot === 'A')
                return (
                  <div className="cs-compose-card cs-compose-a">
                    <div className="cs-compose-top">
                      <span className="cs-compose-slot cs-badge-a">Slot A</span>
                      {bgA && <span className="cs-compose-bg-label">{bgA.prompt?.slice(0, 40)}…</span>}
                    </div>
                    {!comp && (
                      <button
                        className="cs-compose-btn cs-compose-btn-a"
                        onClick={() => onComposite('A')}
                        disabled={!canCompositeA}
                      >
                        🎞 Composite with A
                      </button>
                    )}
                    {comp?.status === 'loading' && (
                      <div className="cs-compositing">
                        <div className="cs-spinner" />
                        <span>Submitting to Shotstack…</span>
                      </div>
                    )}
                    {comp?.status === 'pending' && (
                      <div className="cs-compositing">
                        <div className="cs-spinner" />
                        <span>Rendering composite… (2–5 min)</span>
                      </div>
                    )}
                    {comp?.status === 'succeeded' && comp.video_url && (
                      <div className="cs-result">
                        <video src={comp.video_url} controls className="cs-final-video" playsInline />
                        <a href={comp.video_url} download className="cs-download-btn">⬇ Download 9:16</a>
                      </div>
                    )}
                    {(comp?.status === 'failed' || comp?.status === 'error') && (
                      <div className="cs-compose-error">❌ {comp.error || 'Render failed'}</div>
                    )}
                  </div>
                )
              })()}

              {/* Slot B */}
              {(() => {
                const comp = compositeForSlot('B')
                const bgB = succeededBgs.find(b => b.slot === 'B')
                return (
                  <div className="cs-compose-card cs-compose-b">
                    <div className="cs-compose-top">
                      <span className="cs-compose-slot cs-badge-b">Slot B</span>
                      {bgB && <span className="cs-compose-bg-label">{bgB.prompt?.slice(0, 40)}…</span>}
                    </div>
                    {!comp && (
                      <button
                        className="cs-compose-btn cs-compose-btn-b"
                        onClick={() => onComposite('B')}
                        disabled={!canCompositeB}
                      >
                        🎞 Composite with B
                      </button>
                    )}
                    {comp?.status === 'loading' && (
                      <div className="cs-compositing">
                        <div className="cs-spinner" />
                        <span>Submitting to Shotstack…</span>
                      </div>
                    )}
                    {comp?.status === 'pending' && (
                      <div className="cs-compositing">
                        <div className="cs-spinner" />
                        <span>Rendering composite… (2–5 min)</span>
                      </div>
                    )}
                    {comp?.status === 'succeeded' && comp.video_url && (
                      <div className="cs-result">
                        <video src={comp.video_url} controls className="cs-final-video" playsInline />
                        <a href={comp.video_url} download className="cs-download-btn">⬇ Download 9:16</a>
                      </div>
                    )}
                    {(comp?.status === 'failed' || comp?.status === 'error') && (
                      <div className="cs-compose-error">❌ {comp.error || 'Render failed'}</div>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>

          {anyDone && (
            <p className="cs-output-note">
              ✅ Your 9:16 postable videos are ready · Avatar + background + caption + music composited by Shotstack
            </p>
          )}
        </div>
      )}
    </div>
  )
}
