import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api'
import useStore from '../store'
import Avatar from '../components/Avatar'
import './DiscussionDetail.css'

function Comment({ comment, discussionId, depth = 0, onVote }) {
  const user = useStore(s => s.user)
  const [showReply, setShowReply] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()

  const submitReply = async () => {
    if (!user) return navigate('/login')
    if (!replyText.trim()) return
    try {
      await api.post(`/discussions/${discussionId}/comments`, { content: replyText, parent_id: comment.comment_id })
      setReplyText('')
      setShowReply(false)
    } catch (e) {}
  }

  return (
    <div className={`comment-thread depth-${Math.min(depth, 4)}`}>
      <div className="comment-node">
        <div className="comment-votes">
          <button className={`vote-btn up ${comment.user_vote === 1 ? 'active' : ''}`} onClick={() => onVote(comment.comment_id, 1)}>▲</button>
          <span className={`vote-score ${(comment.upvote_count - comment.downvote_count) > 0 ? 'positive' : (comment.upvote_count - comment.downvote_count) < 0 ? 'negative' : ''}`}>
            {comment.upvote_count - comment.downvote_count}
          </span>
          <button className={`vote-btn down ${comment.user_vote === -1 ? 'active' : ''}`} onClick={() => onVote(comment.comment_id, -1)}>▼</button>
        </div>
        <div className="comment-content">
          <div className="comment-header">
            <Avatar user={comment} size="sm" />
            <span className="username" style={{ fontSize: '0.85rem' }}>{comment.display_name || comment.username}</span>
          </div>
          <p className="comment-text">{comment.content}</p>
          <div className="comment-actions">
            {comment.replies?.length > 0 && (
              <button className="comment-action-btn" onClick={() => setCollapsed(v => !v)}>
                {collapsed ? `▶ ${comment.replies.length} Antworten` : '▼ Einklappen'}
              </button>
            )}
            <button className="comment-action-btn" onClick={() => setShowReply(v => !v)}>💬 Antworten</button>
          </div>
          {showReply && (
            <div className="reply-input">
              <input
                className="input"
                placeholder="Antwort..."
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitReply()}
                style={{ fontSize: '0.85rem', padding: '8px 12px' }}
              />
              <button className="btn btn-secondary btn-sm" onClick={submitReply}>↩</button>
            </div>
          )}
        </div>
      </div>
      {!collapsed && comment.replies?.map(reply => (
        <Comment key={reply.comment_id} comment={reply} discussionId={discussionId} depth={depth + 1} onVote={onVote} />
      ))}
    </div>
  )
}

export default function DiscussionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useStore(s => s.user)
  const showToast = useStore(s => s.showToast)
  const [discussion, setDiscussion] = useState(null)
  const [comments, setComments] = useState([])
  const [sort, setSort] = useState('top')
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')

  useEffect(() => { load() }, [id, sort])

  const load = async () => {
    setLoading(true)
    try {
      const [dRes, cRes] = await Promise.all([
        api.get(`/discussions/${id}`),
        api.get(`/discussions/${id}/comments?sort=${sort}`)
      ])
      setDiscussion(dRes.data)
      setComments(cRes.data)
    } catch (e) {}
    setLoading(false)
  }

  const submitComment = async () => {
    if (!user) return navigate('/login')
    if (!newComment.trim()) return
    try {
      const res = await api.post(`/discussions/${id}/comments`, { content: newComment })
      setComments(prev => [{ ...res.data, replies: [] }, ...prev])
      setNewComment('')
      showToast('💬 Kommentar gepostet!')
    } catch (e) {
      showToast('❌ Fehler')
    }
  }

  const handleVote = async (commentId, voteVal) => {
    if (!user) return navigate('/login')
    try {
      await api.post(`/discussions/comments/${commentId}/vote`, { vote: voteVal })
      // Reload for simplicity
      const res = await api.get(`/discussions/${id}/comments?sort=${sort}`)
      setComments(res.data)
    } catch (e) {}
  }

  if (loading) return <div className="page flex-center"><div className="loading-spinner" /></div>
  if (!discussion) return <div className="page flex-center"><p>Nicht gefunden</p></div>

  return (
    <div className="page discussion-detail-page">
      <header className="detail-header">
        <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}>← Zurück</button>
        <h1 style={{ fontSize: '0.95rem', fontFamily: 'Orbitron', flex: 1, margin: '0 12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {discussion.title}
        </h1>
      </header>

      <div className="scroll-container" style={{ padding: '16px' }}>
        {/* Discussion post */}
        <div className="discussion-post card">
          <div className="flex gap-12 mb-8">
            <Avatar user={discussion} size="md" />
            <div>
              <div className="username">{discussion.display_name || discussion.username}</div>
              <div className="text-muted" style={{ fontSize: '0.75rem' }}>{new Date(discussion.created_at).toLocaleDateString('de-DE')}</div>
            </div>
          </div>
          {discussion.content && <p style={{ fontSize: '0.95rem', lineHeight: 1.5 }}>{discussion.content}</p>}
          <div className="flex gap-8 mt-8" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--neon-green)' }}>▲ {discussion.upvote_count}</span>
            <span style={{ color: 'var(--neon-pink)' }}>▼ {discussion.downvote_count}</span>
            <span>💬 {discussion.comment_count}</span>
          </div>
        </div>

        {/* Comment input */}
        {user && (
          <div className="comment-input-area">
            <textarea
              className="input"
              placeholder="Dein Kommentar..."
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              rows={3}
            />
            <button className="btn btn-primary btn-full mt-8" onClick={submitComment}>💬 Kommentieren</button>
          </div>
        )}

        {/* Sort */}
        <div className="sort-tabs mt-16">
          {['top', 'new', 'controversial'].map(s => (
            <button key={s} className={`sort-tab ${sort === s ? 'active' : ''}`} onClick={() => setSort(s)}>
              {s === 'top' ? '🔥 Top' : s === 'new' ? '🆕 Neu' : '⚡ Kontrovers'}
            </button>
          ))}
        </div>

        {/* Comments tree */}
        <div className="comments-tree mt-16">
          {comments.length === 0 ? (
            <p className="text-muted text-center">Sei der Erste! 💬</p>
          ) : (
            comments.map(c => (
              <Comment key={c.comment_id} comment={c} discussionId={id} onVote={handleVote} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
