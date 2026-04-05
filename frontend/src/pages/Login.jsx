import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import useStore from '../store'
import './Auth.css'

export default function Login() {
  const setAuth = useStore(s => s.setAuth)
  const showToast = useStore(s => s.showToast)
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await api.post('/auth/login', { identifier, password })
      setAuth(res.data.token, res.data.user)
      showToast('✨ Willkommen zurück!')
      navigate('/')
    } catch (err) {
      showToast('❌ ' + (err.response?.data?.error || 'Login fehlgeschlagen'))
    }
    setLoading(false)
  }

  return (
    <div className="auth-page">
      <div className="auth-bg" />
      <div className="auth-container">
        <div className="auth-logo">
          <h1 className="neon-text-cyan">TheBoard</h1>
          <p className="text-muted">🎮 The Social Gaming Platform</p>
        </div>

        <form className="auth-form card" onSubmit={handleSubmit}>
          <h2 className="font-mono mb-16" style={{ fontSize: '1.1rem', color: 'var(--neon-pink)' }}>LOGIN</h2>

          <input
            className="input mb-8"
            type="text"
            placeholder="Username oder Email"
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            required
          />
          <input
            className="input mb-16"
            type="password"
            placeholder="Passwort"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? '⏳ Loading...' : '🚀 Einloggen'}
          </button>

          <div className="text-center mt-16">
            <span className="text-muted">Noch kein Account? </span>
            <button type="button" className="link-btn" onClick={() => navigate('/register')}>Registrieren</button>
          </div>
        </form>
      </div>
    </div>
  )
}
