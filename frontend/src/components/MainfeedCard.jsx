import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Avatar from './Avatar'
import api from '../api'
import useStore from '../store'
import './MainfeedCard.css'

export default function MainfeedCard({ post, onInteract }) {
  const user = useStore(s => s.user)
  const showToast = useStore(s => s.showToast)
  const navigate = useNavigate()
  const [reaction, setReaction] = useState(post.user_interaction)
  const [likes, setLikes] = useState(post.like_count || 0)
  const [dislikes, setDislikes] = useState(post.dislike_count || 0)
  const [particleEmoji, setParticleEmoji] = useState(null)
  const [particlePos, setParticlePos] = useState({ x: 0, y: 0 })

  const react = async (type, e) => {
    if (!user) return navigate('/login')
    const rect = e.currentTarget.getBoundingClientRect()
    setParticlePos({ x: rect.left + rect.width / 2, y: rect.top })
    setParticleEmoji(type === 'like' ? '❤️' : '👎')
    setTimeout(() => setParticleEmoji(null), 1000)

    const prev = reaction
    try {
      const res = await api.post(`/mainfeed/${post.post_id}/interact`, { type })
      setReaction(res.data.type)

      // Optimistic update
      if (prev === 'like') setLikes(l => l - 1)
      if (prev === 'dislike') setDislikes(d => d - 1)
      if (res.data.type === 'like') setLikes(l => l + 1)
      if (res.data.type === 'dislike') setDislikes(d => d + 1)
    } catch (err) {
      showToast('❌ Fehler')
    }
  }

  const startDiscussion = async () => {
    if (!user) return navigate('/login')
    if (post.discussion_id) {
      return navigate(`/discussions/${post.discussion_id}`)
    }
    try {
      const res = await api.post('/discussions', {
        title: post.content.slice(0, 80),
        content: post.content,
        mainfeed_post_id: post.post_id
      })
      showToast('💬 Diskussion gestartet!')
      navigate(`/discussions/${res.data.discussion_id}`)
    } catch (e) {
      showToast('❌ Fehler')
    }
  }

  const isAd = post.slot_type === 'ad'

  return (
    <article className={`mainfeed-card animate-fade-in ${isAd ? 'mainfeed-card-ad' : ''}`}>
      {isAd && <div className="ad-badge-main">⚡ Gesponsert</div>}

      <div className="mainfeed-header">
        <div className="mainfeed-user" onClick={() => navigate(`/profile/${post.user_id}`)}>
          <Avatar user={post} size="sm" />
          <div>
            <div className="username">{post.display_name || post.username}</div>
            <div className="text-muted" style={{ fontSize: '0.75rem' }}>
              @{post.user_hashtag} · {timeAgo(post.created_at)}
            </div>
          </div>
        </div>
      </div>

      <div className="mainfeed-content">
        {post.content && <p className="mainfeed-text">{post.content}</p>}
        {post.media_url && (
          post.media_type === 'gif' || post.media_url?.endsWith('.gif') ? (
            <img src={post.media_url} alt="media" className="mainfeed-media" />
          ) : (
            <img src={post.media_url} alt="media" className="mainfeed-media" />
          )
        )}
      </div>

      {(post.hashtags || []).length > 0 && (
        <div className="mainfeed-hashtags">
          {post.hashtags.map(tag => <span key={tag} className="hashtag">#{tag}</span>)}
        </div>
      )}

      <div className="mainfeed-actions">
        <button
          className={`mainfeed-action-btn ${reaction === 'like' ? 'active-like' : ''}`}
          onClick={(e) => react('like', e)}
        >
          ❤️ {likes}
        </button>
        <button
          className={`mainfeed-action-btn ${reaction === 'dislike' ? 'active-dislike' : ''}`}
          onClick={(e) => react('dislike', e)}
        >
          👎 {dislikes}
        </button>
        <button
          className={`mainfeed-action-btn ${post.discussion_id ? 'has-discussion' : ''}`}
          onClick={startDiscussion}
        >
          💬 {post.comment_count || 0}
        </button>
      </div>

      {particleEmoji && (
        <div className="particle" style={{ left: particlePos.x, top: particlePos.y }}>{particleEmoji}</div>
      )}
    </article>
  )
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'gerade eben'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}
