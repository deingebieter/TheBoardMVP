import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import useStore from '../store'
import Avatar from '../components/Avatar'
import './Settings.css'

export default function Settings() {
  const navigate = useNavigate()
  const user = useStore(s => s.user)
  const updateUser = useStore(s => s.updateUser)
  const logout = useStore(s => s.logout)
  const bgMusicEnabled = useStore(s => s.bgMusicEnabled)
  const toggleBgMusic = useStore(s => s.toggleBgMusic)
  const showToast = useStore(s => s.showToast)

  const [form, setForm] = useState({
    display_name: user?.display_name || '',
    bio: user?.bio || '',
    links: user?.links || '',
    region: user?.region || 'global',
    city: user?.city || '',
  })
  const [saving, setSaving] = useState(false)
  const [hashtags, setHashtags] = useState([])
  const [newHashtag, setNewHashtag] = useState('')

  useEffect(() => {
    loadHashtags()
  }, [])

  const loadHashtags = async () => {
    try {
      const res = await api.get('/users/me/hashtag-follows')
      setHashtags(res.data)
    } catch (e) {}
  }

  const saveProfile = async () => {
    setSaving(true)
    try {
      const formData = new FormData()
      Object.entries(form).forEach(([k, v]) => formData.append(k, v))
      formData.append('bg_music_enabled', bgMusicEnabled ? '1' : '0')
      const res = await api.patch('/users/me', formData)
      updateUser(res.data)
      showToast('✅ Profil gespeichert!')
    } catch (e) {
      showToast('❌ Fehler beim Speichern')
    }
    setSaving(false)
  }

  const followHashtag = async () => {
    if (!newHashtag.trim()) return
    const tag = newHashtag.trim().toLowerCase().replace(/^#/, '')
    try {
      const res = await api.post(`/users/me/hashtag-follows/${tag}`)
      setHashtags(prev => [...prev, res.data.hashtag])
      setNewHashtag('')
      showToast(`✅ #${tag} gefolgt`)
    } catch (e) {
      showToast('❌ Fehler')
    }
  }

  const unfollowHashtag = async (name) => {
    try {
      await api.delete(`/users/me/hashtag-follows/${name}`)
      setHashtags(prev => prev.filter(h => h.name !== name))
      showToast(`❌ #${name} entfolgt`)
    } catch (e) {}
  }

  const update = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  return (
    <div className="page settings-page">
      <header className="feed-header">
        <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}>← Zurück</button>
        <h1 className="font-mono" style={{ fontSize: '1.1rem', color: 'var(--neon-cyan)' }}>⚙️ Einstellungen</h1>
      </header>

      <div className="scroll-container" style={{ padding: '16px' }}>
        {/* Profile edit */}
        <section className="settings-section card mb-16">
          <h3 className="settings-section-title">👤 Profil bearbeiten</h3>

          <div className="settings-field">
            <label>Anzeigename</label>
            <input className="input" value={form.display_name} onChange={update('display_name')} placeholder="Dein Name" />
          </div>
          <div className="settings-field">
            <label>Bio</label>
            <textarea className="input" value={form.bio} onChange={update('bio')} placeholder="Über dich..." rows={3} />
          </div>
          <div className="settings-field">
            <label>Links</label>
            <input className="input" value={form.links} onChange={update('links')} placeholder="https://..." />
          </div>
          <div className="settings-field">
            <label>Region</label>
            <select className="input" value={form.region} onChange={update('region')}>
              <option value="global">🌍 Global</option>
              <option value="EU">🇪🇺 Europe</option>
              <option value="USA">🇺🇸 USA</option>
              <option value="DE">🇩🇪 Deutschland</option>
              <option value="AT">🇦🇹 Österreich</option>
              <option value="CH">🇨🇭 Schweiz</option>
            </select>
          </div>
          <div className="settings-field">
            <label>Stadt</label>
            <input className="input" value={form.city} onChange={update('city')} placeholder="Deine Stadt" />
          </div>

          <button className="btn btn-primary btn-full mt-8" onClick={saveProfile} disabled={saving}>
            {saving ? '⏳ Speichern...' : '💾 Speichern'}
          </button>
        </section>

        {/* Arcade Music */}
        <section className="settings-section card mb-16">
          <h3 className="settings-section-title">🎵 Arcade Musik</h3>
          <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: 12 }}>
            Retro 90s Arcade Hintergrundmusik wenn kein Video läuft
          </p>
          <div className="toggle-row">
            <span>Hintergrundmusik aktivieren</span>
            <button
              className={`toggle-btn ${bgMusicEnabled ? 'active' : ''}`}
              onClick={toggleBgMusic}
            >
              <span className="toggle-thumb" />
            </button>
          </div>
          {bgMusicEnabled && (
            <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: 8 }}>
              🎮 Musik aktiv - Soundtrack wird geladen
            </p>
          )}
        </section>

        {/* Hashtag follows */}
        <section className="settings-section card mb-16">
          <h3 className="settings-section-title">🏷️ Gefolgten Hashtags</h3>
          <div className="hashtag-input-row">
            <input
              className="input"
              placeholder="#hashtag folgen..."
              value={newHashtag}
              onChange={e => setNewHashtag(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && followHashtag()}
            />
            <button className="btn btn-primary btn-sm" onClick={followHashtag}>+ Folgen</button>
          </div>
          <div className="hashtag-chips mt-8">
            {hashtags.map(h => (
              <div key={h.id} className="hashtag-chip">
                <span className="hashtag">#{h.name}</span>
                <button className="hashtag-chip-remove" onClick={() => unfollowHashtag(h.name)}>✕</button>
              </div>
            ))}
            {hashtags.length === 0 && <p className="text-muted" style={{ fontSize: '0.85rem' }}>Noch keine Hashtags gefolgt</p>}
          </div>
        </section>

        {/* Account info */}
        <section className="settings-section card mb-16">
          <h3 className="settings-section-title">🎮 Account Info</h3>
          <div className="info-row">
            <span className="text-muted">User ID</span>
            <span className="font-mono">{user?.user_id}</span>
          </div>
          <div className="info-row">
            <span className="text-muted">Username</span>
            <span>@{user?.username}</span>
          </div>
          <div className="info-row">
            <span className="text-muted">Hashtag</span>
            <span className="neon-text-cyan">@{user?.user_hashtag}</span>
          </div>
        </section>

        {/* Logout */}
        <button className="btn btn-full mt-8" style={{ background: 'rgba(255,0,100,0.1)', border: '1px solid rgba(255,0,100,0.3)', color: '#ff0064' }} onClick={() => { logout(); navigate('/login') }}>
          🚪 Ausloggen
        </button>
      </div>
    </div>
  )
}
