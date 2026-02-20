import './PostGrid.css'

function formatNumber(n) {
  if (!n && n !== 0) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

function PostCard({ post }) {
  const caption = post.caption ? post.caption.slice(0, 100) + (post.caption.length > 100 ? '…' : '') : ''
  const typeIcon = post.type === 'Video' ? '🎥' : post.type === 'Sidecar' ? '🖼️' : '📷'

  return (
    <a
      className="post-card"
      href={post.url || '#'}
      target="_blank"
      rel="noopener noreferrer"
    >
      <div className="post-thumb-wrap">
        {post.displayUrl ? (
          <img
            className="post-thumb"
            src={post.displayUrl}
            alt="post thumbnail"
            loading="lazy"
            onError={e => { e.target.style.display = 'none' }}
          />
        ) : (
          <div className="post-thumb-placeholder">{typeIcon}</div>
        )}
        <span className="post-type-badge">{typeIcon}</span>
      </div>
      <div className="post-meta">
        <div className="post-stats">
          <span>❤️ {formatNumber(post.likesCount)}</span>
          <span>💬 {formatNumber(post.commentsCount)}</span>
        </div>
        {caption && <p className="post-caption">{caption}</p>}
      </div>
    </a>
  )
}

export default function PostGrid({ posts }) {
  if (!posts || posts.length === 0) {
    return <p className="no-posts">No posts to display.</p>
  }

  const sorted = [...posts].sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0))

  return (
    <div className="post-grid-wrapper">
      <div className="post-grid">
        {sorted.map((post, i) => (
          <PostCard key={post.id || post.shortCode || i} post={post} />
        ))}
      </div>
    </div>
  )
}
