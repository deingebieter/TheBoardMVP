import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import useStore from '../store'
import './Competitions.css'

const TYPE_ICONS = { like: '❤️', comment: '💬', engagement: '⚡' }
const TIER_COLORS = { normal: 'var(--neon-cyan)', high_end: 'var(--neon-gold)' }

export default function Competitions() {
  const navigate = useNavigate()
  const user = useStore(s => s.user)
  const showToast = useStore(s => s.showToast)
  const [competitions, setCompetitions] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [postId, setPostId] = useState('')
  const [entering, setEntering] = useState(false)
  const [leaderboard, setLeaderboard] = useState([])

  useEffect(() => { loadCompetitions() }, [])

  const loadCompetitions = async () => {
    setLoading(true)
    try {
      const res = await api.get('/competitions?status=active')
      setCompetitions(res.data)
    } catch (e) {}
    setLoading(false)
  }

  const openLeaderboard = async (comp) => {
    setSelected(comp)
    try {
      const res = await api.get(`/competitions/${comp.competition_id}/leaderboard`)
      setLeaderboard(res.data)
    } catch (e) {}
  }

  const enter = async (competition_id, is_highlighted = false) => {
    if (!postId.trim()) return showToast('Post ID eingeben')
    setEntering(true)
    try {
      await api.post(`/competitions/${competition_id}/enter`, { post_id: postId, is_highlighted })
      showToast('🏆 Eingetragen!')
      loadCompetitions()
    } catch (e) {
      showToast('❌ ' + (e.response?.data?.error || 'Fehler'))
    }
    setEntering(false)
  }

  const RANK_ICONS = ['🥇', '🥈', '🥉']

  return (
    <div className="page competitions-page">
      <header className="feed-header">
        <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}>← Zurück</button>
        <h1 className="font-mono neon-text-gold" style={{ fontSize: '1.1rem' }}>🏆 Competitions</h1>
      </header>

      <div className="scroll-container" style={{ padding: '16px' }}>
        {loading ? (
          <div className="loading-spinner" />
        ) : competitions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🏆</div>
            <h2>Keine aktiven Competitions</h2>
            <p className="text-muted">Komm später wieder!</p>
          </div>
        ) : (
          competitions.map(comp => (
            <div key={comp.competition_id} className="competition-card card animate-fade-in">
              <div className="comp-header">
                <div className="comp-type-badge" style={{ color: TIER_COLORS[comp.tier] }}>
                  {TYPE_ICONS[comp.type]} {comp.type.toUpperCase()}
                </div>
                <div className={`comp-tier badge ${comp.tier === 'high_end' ? 'badge-gold' : 'badge-silver'}`}>
                  {comp.tier === 'high_end' ? '⭐ High-End' : 'Normal'}
                </div>
              </div>

              <h3 className="comp-title">{comp.title}</h3>

              <div className="comp-rewards">
                <div className="reward-item">🥇 {comp.reward_1st_bronze > 0 ? `${comp.reward_1st_bronze} 🥉` : ''} {comp.reward_1st_silver > 0 ? `${comp.reward_1st_silver} 🥈` : ''}</div>
                <div className="reward-item">🥈 {comp.reward_2nd_bronze > 0 ? `${comp.reward_2nd_bronze} 🥉` : ''}</div>
                <div className="reward-item">🥉 {comp.reward_3rd_bronze > 0 ? `${comp.reward_3rd_bronze} 🥉` : ''}</div>
              </div>

              {comp.ends_at && (
                <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                  ⏰ Endet: {new Date(comp.ends_at).toLocaleDateString('de-DE')}
                </div>
              )}

              <div className="comp-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => openLeaderboard(comp)}>
                  📊 Leaderboard ({comp.entry_count})
                </button>
                {!comp.user_entry && (
                  <button className="btn btn-primary btn-sm" onClick={() => setSelected(comp)}>
                    🎮 Teilnehmen
                  </button>
                )}
                {comp.user_entry && (
                  <span className="badge badge-silver">✓ Teilgenommen</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Entry/Leaderboard Modal */}
      {selected && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setSelected(null)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="font-mono neon-text-gold">{leaderboard.length > 0 ? '📊 Leaderboard' : '🎮 Einschreiben'}</h3>
              <button className="btn btn-icon" onClick={() => { setSelected(null); setLeaderboard([]) }} style={{ color: 'var(--text-muted)' }}>✕</button>
            </div>

            {leaderboard.length > 0 ? (
              <div className="leaderboard">
                {leaderboard.map((entry, i) => (
                  <div key={entry.post_id} className="leaderboard-row">
                    <span className="rank-icon">{RANK_ICONS[i] || `#${i + 1}`}</span>
                    <div className="flex-1">
                      <div className="username">{entry.username?.display_name || entry.username?.username}</div>
                      <div className="text-muted" style={{ fontSize: '0.8rem' }}>Score: {entry.score}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <p className="text-secondary mb-8">Füge deine Post-ID ein um teilzunehmen:</p>
                <input
                  className="input mb-8"
                  placeholder="Post ID (UUID)..."
                  value={postId}
                  onChange={e => setPostId(e.target.value)}
                />
                <div className="flex gap-8">
                  <button className="btn btn-primary" onClick={() => enter(selected.competition_id)} disabled={entering}>
                    🎮 Normal teilnehmen
                  </button>
                  {selected.tier === 'high_end' && (
                    <button className="btn btn-gold" onClick={() => enter(selected.competition_id, true)} disabled={entering}>
                      ⭐ High-End
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
