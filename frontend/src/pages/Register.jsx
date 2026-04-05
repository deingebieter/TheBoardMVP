import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import useStore from '../store'

export default function Register() {
  const setAuth = useStore(s => s.setAuth)
  const showToast = useStore(s => s.showToast)
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', user_hashtag: '', email: '', password: '', display_name: '' })
  const [loading, setLoading] = useState(false)

  const update = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password.length < 6) return showToast('Passwort min. 6 Zeichen')
    setLoading(true)
    try {
      const res = await api.post('/auth/register', form)
      setAuth(res.data.token, res.data.user)
      showToast('🎉 Willkommen bei TheBoard!')
      navigate('/')
    } catch (err) {
      showToast('❌ ' + (err.response?.data?.error || 'Registrierung fehlgeschlagen'))
    }
    setLoading(false)
  }

  return (
    <div className="auth-page">
      <div className="auth-bg" />
      <div className="auth-container">
        <div className="auth-logo">
          <h1 className="neon-text-cyan">TheBoard</h1>
          <p className="text-muted">🎮 Join the Game</p>
        </div>

        <form className="auth-form card" onSubmit={handleSubmit}>
          <h2 className="font-mono mb-16" style={{ fontSize: '1.1rem', color: 'var(--neon-green)' }}>REGISTRIEREN</h2>

          <input className="input mb-8" type="text" placeholder="Anzeigename" value={form.display_name} onChange={update('display_name')} />
          <input className="input mb-8" type="text" placeholder="Username (unique)" value={form.username} onChange={update('username')} required />
          <div className="input-prefix-wrap mb-8">
            <span className="input-prefix neon-text-cyan">@</span>
            <input
              className="input"
              type="text"
              placeholder="dein_hashtag (unique)"
              value={form.user_hashtag}
              onChange={(e) => setForm(f => ({ ...f, user_hashtag: e.target.value.replace(/[^a-z0-9_]/gi, '').toLowerCase() }))}
              required
              style={{ paddingLeft: '28px' }}
            />
          </div>
          <input className="input mb-8" type="email" placeholder="Email" value={form.email} onChange={update('email')} required />
          <input className="input mb-16" type="password" placeholder="Passwort (min. 6 Zeichen)" value={form.password} onChange={update('password')} required />

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? '⏳ Creating...' : '🎮 Account erstellen'}
          </button>

          <div className="text-center mt-16">
            <span className="text-muted">Schon registriert? </span>
            <button type="button" className="link-btn" onClick={() => navigate('/login')}>Einloggen</button>
          </div>
        </form>
      </div>
    </div>
  )
}
