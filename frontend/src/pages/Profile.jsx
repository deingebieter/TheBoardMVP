import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api'
import useStore from '../store'
import Avatar from '../components/Avatar'
import './Profile.css'

export default function Profile() {
  const { user_id } = useParams()
  const navigate = useNavigate()
  const currentUser = useStore(s => s.user)
  const updateUser = useStore(s => s.updateUser)
  const showToast = useStore(s => s.showToast)
  const isOwn = !user_id || user_id === currentUser?.user_id

  const [profile, setProfile] = useState(null)
  const [coins, setCoins] = useState({ bronze: 0, silver: 0, gold: 0 })
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('fyp')

  useEffect(() => { loadProfile() }, [user_id, currentUser?.user_id])

  const loadProfile = async () => {
    setLoading(true)
    try {
      const targetId = user_id || currentUser?.user_id
      if (!targetId) return
      const res = isOwn
        ? await api.get('/users/me/profile')
        : await api.get(`/users/${targetId}`)
      setProfile(res.data)
      if (res.data.coins) setCoins(res.data.coins)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const toggleFollow = async () => {
    if (!currentUser) return navigate('/login')
    try {
      if (profile.is_following) {
        await api.delete(`/users/${profile.user_id}/follow`)
        setProfile(p => ({ ...p, is_following: false, follower_count: p.follower_count - 1 }))
      } else {
        await api.post(`/users/${profile.user_id}/follow`)
        setProfile(p => ({ ...p, is_following: true, follower_count: p.follower_count + 1 }))
      }
    } catch (e) {
      showToast('❌ Fehler')
    }
  }

  if (loading) return <div className="page flex-center"><div className="loading-spinner" /></div>
  if (!profile) return <div className="page flex-center"><p>Profil nicht gefunden</p></div>

  return (
    <div className="page profile-page">
      <header className="profile-header">
        <div className="profile-header-bg" />
        <div className="profile-info">
          <Avatar user={profile} size="xl" className="profile-avatar" />
          <div className="profile-details">
            <h2 className="profile-name">{profile.display_name || profile.username}</h2>
            <div className="profile-handle">
              <span className="neon-text-cyan">@{profile.user_hashtag}</span>
              <span className="text-muted" style={{ marginLeft: 8, fontSize: '0.8rem' }}>#{profile.user_id}</span>
            </div>
            {profile.bio && <p className="profile-bio">{profile.bio}</p>}

            <div className="profile-stats">
              <div className="stat">
                <span className="stat-number">{profile.follower_count || 0}</span>
                <span className="stat-label">Follower</span>
              </div>
              <div className="stat">
                <span className="stat-number">{profile.following_count || 0}</span>
                <span className="stat-label">Following</span>
              </div>
            </div>

            {/* Coins */}
            {isOwn && (
              <div className="coin-display">
                <span className="coin coin-bronze">🥉 {coins.bronze}</span>
                <span className="coin coin-silver">🥈 {coins.silver}</span>
                <span className="coin coin-gold">🥇 {coins.gold}</span>
              </div>
            )}

            <div className="profile-actions">
              {isOwn ? (
                <>
                  <button className="btn btn-secondary btn-sm" onClick={() => navigate('/settings')}>
                    ⚙️ Einstellungen
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => navigate('/competitions')}>
                    🏆 Competitions
                  </button>
                </>
              ) : (
                <button
                  className={`btn ${profile.is_following ? 'btn-secondary' : 'btn-primary'} btn-sm`}
                  onClick={toggleFollow}
                >
                  {profile.is_following ? '✓ Gefolgt' : '+ Folgen'}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="profile-tabs">
        <button className={`profile-tab ${tab === 'fyp' ? 'active' : ''}`} onClick={() => setTab('fyp')}>🎮 FYP</button>
        <button className={`profile-tab ${tab === 'main' ? 'active' : ''}`} onClick={() => setTab('main')}>📢 Posts</button>
        {isOwn && <button className={`profile-tab ${tab === 'coins' ? 'active' : ''}`} onClick={() => setTab('coins')}>💰 Coins</button>}
      </div>

      <div className="scroll-container" style={{ padding: '16px' }}>
        {tab === 'fyp' && <UserFYPPosts userId={profile.user_id} />}
        {tab === 'main' && <p className="text-muted text-center">Posts werden bald angezeigt</p>}
        {tab === 'coins' && isOwn && <CoinPanel coins={coins} showToast={showToast} onUpdate={(newCoins) => setCoins(newCoins)} />}
      </div>
    </div>
  )
}

function UserFYPPosts({ userId }) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/fyp?page=1&limit=20`).then(res => {
      const userPosts = res.data.posts.filter(p => p.user_id === userId)
      setPosts(userPosts)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [userId])

  if (loading) return <div className="loading-spinner" />
  if (!posts.length) return <p className="text-muted text-center">Noch keine Posts</p>

  return (
    <div className="profile-grid">
      {posts.map(post => (
        <div key={post.post_id} className="profile-grid-item">
          {post.media_type === 'video' ? (
            <video src={post.media_url} className="grid-media" muted playsInline />
          ) : post.media_url ? (
            <img src={post.media_url} alt="" className="grid-media" />
          ) : (
            <div className="grid-media grid-placeholder">🎬</div>
          )}
        </div>
      ))}
    </div>
  )
}

function CoinPanel({ coins, showToast, onUpdate }) {
  const [amount, setAmount] = useState('')
  const [converting, setConverting] = useState(false)

  const convert = async (type) => {
    if (!amount || amount < 1) return showToast('Menge eingeben')
    setConverting(true)
    try {
      const res = await api.post('/coins/convert', { from: type, amount: parseInt(amount) })
      onUpdate(res.data.balance)
      showToast('✅ Coins konvertiert!')
      setAmount('')
    } catch (e) {
      showToast('❌ ' + (e.response?.data?.error || 'Fehler'))
    }
    setConverting(false)
  }

  return (
    <div className="coin-panel">
      <h3 className="font-mono neon-text-gold mb-8">💰 Mein Wallet</h3>
      <div className="coin-balances">
        <div className="coin-balance-card">
          <div style={{ fontSize: '2rem' }}>🥉</div>
          <div className="coin-amount coin-bronze">{coins.bronze}</div>
          <div className="coin-label">Bronze</div>
          <div className="text-muted" style={{ fontSize: '0.7rem' }}>Competitions</div>
        </div>
        <div className="coin-balance-card">
          <div style={{ fontSize: '2rem' }}>🥈</div>
          <div className="coin-amount coin-silver">{coins.silver}</div>
          <div className="coin-label">Silber</div>
          <div className="text-muted" style={{ fontSize: '0.7rem' }}>Werbung (earned)</div>
        </div>
        <div className="coin-balance-card">
          <div style={{ fontSize: '2rem' }}>🥇</div>
          <div className="coin-amount coin-gold">{coins.gold}</div>
          <div className="coin-label">Gold</div>
          <div className="text-muted" style={{ fontSize: '0.7rem' }}>Werbung (kaufbar)</div>
        </div>
      </div>

      <div className="convert-section card mt-16">
        <h4 className="font-mono mb-8" style={{ fontSize: '0.85rem', color: 'var(--neon-cyan)' }}>🔄 Konvertieren</h4>
        <p className="text-muted" style={{ fontSize: '0.75rem', marginBottom: 12 }}>
          2 Bronze = 1 Silber · 2 Silber = 1 Gold
        </p>
        <input
          className="input mb-8"
          type="number"
          min="1"
          placeholder="Menge..."
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => convert('bronze_to_silver')} disabled={converting}>
            🥉→🥈
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => convert('silver_to_gold')} disabled={converting}>
            🥈→🥇
          </button>
        </div>
      </div>
    </div>
  )
}
