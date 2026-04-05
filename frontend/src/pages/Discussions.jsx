import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import useStore from '../store'
import Avatar from '../components/Avatar'
import './Discussions.css'

const SORTS = ['new', 'top', 'controversial']

export default function Discussions() {
  const user = useStore(s => s.user)
  const showToast = useStore(s => s.showToast)
  const navigate = useNavigate()
  const [discussions, setDiscussions] = useState([])
  const [sort, setSort] = useState('new')
  const [loading, setLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')

  useEffect(() => { loadDiscussions() }, [sort])

  const loadDiscussions = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/discussions?sort=${sort}&limit=30`)
      setDiscussions(res.data.discussions)
    } catch (e) {}
    setLoading(false)
  }

  const createDiscussion = async (e) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    try {
      const res = await api.post('/discussions', { title: newTitle, content: newContent })
      setDiscussions(prev => [res.data, ...prev])
      setShowCreate(false)
      setNewTitle('')
      setNewContent('')
      showToast('💬 Diskussion erstellt!')
    } catch (e) {
      showToast('❌ Fehler')
    }
  }

  const vote = async (discussion_id, voteVal, e) => {
    e.stopPropagation()
    if (!user) return navigate('/login')
    try {
      await api.post(`/discussions/${discussion_id}/vote`, { vote: voteVal })
      setDiscussions(prev => prev.map(d => {
        if (d.discussion_id !== discussion_id) return d
        const hadUp = d.user_vote === 1
        const hadDown = d.user_vote === -1
        const isRemove = d.user_vote === voteVal
        return {
          ...d,
          upvote_count: d.upvote_count + (voteVal === 1 ? (isRemove ? -1 : (hadDown ? 1 : 1)) : (hadUp ? -1 : 0)),
          downvote_count: d.downvote_count + (voteVal === -1 ? (isRemove ? -1 : (hadUp ? 1 : 1)) : (hadDown ? -1 : 0)),
          user_vote: isRemove ? null : voteVal
        }
      }))
    } catch (e) {}
  }

  return (
    <div className="page discussions-page">
      <header className="feed-header">
        <h1 className="font-mono neon-text-purple" style={{ fontSize: '1.2rem' }}>💬 Diskussionen</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ Neu</button>
      </header>

      {/* Sort tabs */}
      <div className="sort-tabs">
        {SORTS.map(s => (
          <button
            key={s}
            className={`sort-tab ${sort === s ? 'active' : ''}`}
            onClick={() => setSort(s)}
          >
            {s === 'new' ? '🆕 Neu' : s === 'top' ? '🔥 Top' : '⚡ Kontrovers'}
          </button>
        ))}
      </div>

      <div className="scroll-container">
        <div style={{ padding: '12px 16px' }}>
          {loading ? (
            <div className="loading-spinner" />
          ) : discussions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">💬</div>
              <h2>Keine Diskussionen</h2>
              <p className="text-muted">Starte die erste Diskussion!</p>
            </div>
          ) : (
            discussions.map(d => (
              <article
                key={d.discussion_id}
                className="discussion-card animate-fade-in"
                onClick={() => navigate(`/discussions/${d.discussion_id}`)}
              >
                <div className="discussion-votes">
                  <button
                    className={`vote-btn up ${d.user_vote === 1 ? 'active' : ''}`}
                    onClick={(e) => vote(d.discussion_id, 1, e)}
                  >▲</button>
                  <span className={`vote-score ${d.upvote_count - d.downvote_count > 0 ? 'positive' : d.upvote_count - d.downvote_count < 0 ? 'negative' : ''}`}>
                    {d.upvote_count - d.downvote_count}
                  </span>
                  <button
                    className={`vote-btn down ${d.user_vote === -1 ? 'active' : ''}`}
                    onClick={(e) => vote(d.discussion_id, -1, e)}
                  >▼</button>
                </div>
                <div className="discussion-body">
                  <h3 className="discussion-title">{d.title}</h3>
                  {d.content && <p className="discussion-preview">{d.content.slice(0, 100)}{d.content.length > 100 ? '...' : ''}</p>}
                  <div className="discussion-meta">
                    <Avatar user={d} size="sm" />
                    <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                      {d.display_name || d.username} · 💬 {d.comment_count}
                    </span>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="font-mono neon-text-purple">💬 Neue Diskussion</h3>
              <button className="btn btn-icon" onClick={() => setShowCreate(false)} style={{ color: 'var(--text-muted)' }}>✕</button>
            </div>
            <form onSubmit={createDiscussion}>
              <input
                className="input"
                placeholder="Titel der Diskussion..."
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                required
              />
              <textarea
                className="input mt-8"
                placeholder="Beschreibung (optional)..."
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                rows={4}
              />
              <button type="submit" className="btn btn-primary btn-full mt-16">🚀 Erstellen</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
