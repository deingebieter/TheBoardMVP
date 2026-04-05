import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Avatar from './Avatar'
import api from '../api'
import useStore from '../store'
import './FYPCard.css'

const REACTION_ICONS = {
  like: '❤️',
  super_like: '💎',
  dislike: '👎',
  super_dislike: '💀',
  irrelevant: '😶',
}

export default function FYPCard({ post, onInteract }) {
  const user = useStore(s => s.user)
  const showToast = useStore(s => s.showToast)
  const navigate = useNavigate()
  const [reaction, setReaction] = useState(post.user_interaction)
  const [likes, setLikes] = useState(post.likes || 0)
  const [superLikes, setSuperLikes] = useState(post.super_likes || 0)
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const [loadingComments, setLoadingComments] = useState(false)
  const [commentCount, setCommentCount] = useState(post.comment_count || 0)
  const [showReactions, setShowReactions] = useState(false)
  const [particleEmoji, setParticleEmoji] = useState(null)
  const [particlePos, setParticlePos] = useState({ x: 0, y: 0 })

  const react = async (type, e) => {
    if (!user) return navigate('/login')

    // Particle effect
    if (e) {
      const rect = e.currentTarget.getBoundingClientRect()
      setParticlePos({ x: rect.left + rect.width / 2, y: rect.top })
      setParticleEmoji(REACTION_ICONS[type])
      setTimeout(() => setParticleEmoji(null), 1000)
    }

    const prev = reaction
    const newReaction = reaction === type ? null : type
    setReaction(newReaction)

    if (type === 'like') setLikes(l => newReaction === 'like' ? l + 1 : (prev === 'like' ? l - 1 : l))
    if (type === 'super_like') setSuperLikes(l => newReaction === 'super_like' ? l + 1 : (prev === 'super_like' ? l - 1 : l))

    try {
      await api.post(`/fyp/${post.post_id}/interact`, { type })
      onInteract?.(post.post_id, type)
    } catch (err) {
      setReaction(prev)
      showToast('❌ Fehler')
    }
  }

  const loadComments = async () => {
    if (loadingComments) return
    setLoadingComments(true)
    try {
      const res = await api.get(`/fyp/${post.post_id}/comments`)
      setComments(res.data)
    } catch (e) {}
    setLoadingComments(false)
  }

  const toggleComments = () => {
    if (!showComments) loadComments()
    setShowComments(v => !v)
  }

  const submitComment = async () => {
    if (!commentText.trim()) return
    try {
      const res = await api.post(`/fyp/${post.post_id}/comment`, { content: commentText })
      setComments(c => [...c, res.data])
      setCommentCount(n => n + 1)
      setCommentText('')
    } catch (e) {
      showToast('❌ Fehler beim Kommentieren')
    }
  }

  const isAd = post.slot_type === 'ad'

  return (
    <article className={`fyp-card ${isAd ? 'fyp-card-ad' : ''} animate-fade-in`}>
      {isAd && <div className="ad-badge">⚡ Gesponsert</div>}

      {/* Media */}
      <div className="fyp-media">
        {post.media_type === 'video' || post.media_url?.includes('/videos/') ? (
          <video
            src={post.media_url}
            className="fyp-video"
            autoPlay
            muted
            loop
            playsInline
            controls
          />
        ) : post.media_url ? (
          <img src={post.media_url} alt="post" className="fyp-image" />
        ) : null}

        {/* Overlay actions */}
        <div className="fyp-actions">
          <button
            className={`action-btn ${reaction === 'like' ? 'active-like' : ''}`}
            onClick={(e) => react('like', e)}
          >
            <span className="action-icon">❤️</span>
            <span className="action-count">{likes}</span>
          </button>

          <button
            className={`action-btn ${reaction === 'super_like' ? 'active-super-like' : ''}`}
            onClick={(e) => react('super_like', e)}
          >
            <span className="action-icon">💎</span>
            <span className="action-count">{superLikes}</span>
          </button>

          <button
            className={`action-btn ${showComments ? 'active-comment' : ''}`}
            onClick={toggleComments}
          >
            <span className="action-icon">💬</span>
            <span className="action-count">{commentCount}</span>
          </button>

          <button
            className={`action-btn`}
            onClick={() => setShowReactions(v => !v)}
          >
            <span className="action-icon">🎭</span>
          </button>
        </div>

        {/* Extended reactions */}
        {showReactions && (
          <div className="reactions-panel animate-slide-up">
            {Object.entries(REACTION_ICONS).map(([type, icon]) => (
              <button
                key={type}
                className={`reaction-pill ${reaction === type ? 'active' : ''}`}
                onClick={(e) => { react(type, e); setShowReactions(false) }}
              >
                {icon}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="fyp-info">
        <div className="fyp-user" onClick={() => navigate(`/profile/${post.user_id}`)}>
          <Avatar user={post} size="sm" />
          <div>
            <span className="username">{post.display_name || post.username}</span>
            <span className="user-hashtag neon-text-cyan"> @{post.user_hashtag}</span>
          </div>
        </div>

        {post.caption && <p className="fyp-caption">{post.caption}</p>}

        <div className="fyp-hashtags">
          {(post.hashtags || []).map(tag => (
            <span key={tag} className="hashtag">#{tag}</span>
          ))}
        </div>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="comments-section animate-slide-up">
          <div className="comments-list">
            {loadingComments ? (
              <div className="loading-spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
            ) : comments.length === 0 ? (
              <p className="text-muted" style={{ fontSize: '0.85rem' }}>Sei der Erste 💬</p>
            ) : (
              comments.map(c => (
                <div key={c.comment_id} className="comment-item">
                  <Avatar user={c} size="sm" />
                  <div>
                    <span className="username" style={{ fontSize: '0.8rem' }}>{c.display_name || c.username} </span>
                    <span style={{ fontSize: '0.85rem' }}>{c.content}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          {user && (
            <div className="comment-input-row">
              <input
                className="input"
                placeholder="Kommentar..."
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitComment()}
                style={{ fontSize: '0.85rem', padding: '8px 12px' }}
              />
              <button className="btn btn-primary btn-sm" onClick={submitComment}>💬</button>
            </div>
          )}
        </div>
      )}

      {/* Particle effect */}
      {particleEmoji && (
        <div
          className="particle"
          style={{ left: particlePos.x, top: particlePos.y }}
        >
          {particleEmoji}
        </div>
      )}
    </article>
  )
}
