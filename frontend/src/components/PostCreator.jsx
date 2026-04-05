import { useState, useRef } from 'react'
import api from '../api'
import useStore from '../store'
import './PostCreator.css'

export default function PostCreator({ type = 'fyp', onPost, onClose }) {
  const showToast = useStore(s => s.showToast)
  const [content, setContent] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [region, setRegion] = useState('global')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef()

  const handleFile = (e) => {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (type === 'fyp' && !file) return showToast('📹 Video/GIF required for FYP')
    if (!hashtags.trim()) return showToast('🏷️ Add at least one hashtag')

    const formData = new FormData()
    if (file) formData.append('media', file)
    if (content) formData.append('caption', content)
    formData.append('hashtags', hashtags)
    formData.append('region', region)
    if (type === 'mainfeed') formData.append('content', content)

    setLoading(true)
    try {
      const endpoint = type === 'fyp' ? '/fyp' : '/mainfeed'
      const res = await api.post(endpoint, formData)
      showToast('✨ Post veröffentlicht!')
      onPost?.(res.data)
      onClose?.()
    } catch (err) {
      showToast('❌ ' + (err.response?.data?.error || 'Fehler beim Posten'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="post-creator">
      <div className="post-creator-header">
        <h3 className="font-mono" style={{ color: 'var(--neon-cyan)' }}>
          {type === 'fyp' ? '🎮 FYP Post' : '📢 Feed Post'}
        </h3>
        {onClose && (
          <button className="btn btn-icon" onClick={onClose} style={{ color: 'var(--text-muted)' }}>✕</button>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        {type === 'fyp' ? (
          <div className="file-upload-area" onClick={() => fileRef.current?.click()}>
            {preview ? (
              <video src={preview} className="preview-media" autoPlay muted loop playsInline />
            ) : (
              <>
                <div className="upload-icon">🎬</div>
                <p>Video / GIF hochladen</p>
                <p className="text-muted" style={{ fontSize: '0.8rem' }}>Max. 30 Sekunden</p>
              </>
            )}
            <input ref={fileRef} type="file" accept="video/*,image/gif" onChange={handleFile} hidden />
          </div>
        ) : (
          <div className="file-upload-area optional" onClick={() => fileRef.current?.click()}>
            {preview ? (
              <img src={preview} alt="preview" className="preview-media" />
            ) : (
              <>
                <div className="upload-icon">🖼️</div>
                <p>Bild hinzufügen (optional)</p>
              </>
            )}
            <input ref={fileRef} type="file" accept="image/*,image/gif" onChange={handleFile} hidden />
          </div>
        )}

        <div className="mt-16">
          <textarea
            className="input"
            placeholder={type === 'fyp' ? 'Caption...' : 'Was denkst du? ✍️'}
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={3}
            required={type === 'mainfeed'}
          />
        </div>

        <div className="mt-8">
          <input
            className="input"
            placeholder="Hashtags: gaming,neon,theboard"
            value={hashtags}
            onChange={e => setHashtags(e.target.value)}
          />
        </div>

        <div className="mt-8">
          <select className="input" value={region} onChange={e => setRegion(e.target.value)}>
            <option value="global">🌍 Global</option>
            <option value="EU">🇪🇺 Europe</option>
            <option value="USA">🇺🇸 USA</option>
            <option value="DE">🇩🇪 Deutschland</option>
            <option value="AT">🇦🇹 Österreich</option>
            <option value="CH">🇨🇭 Schweiz</option>
          </select>
        </div>

        <button type="submit" className="btn btn-primary btn-full mt-16" disabled={loading}>
          {loading ? '⏳ Uploading...' : '🚀 Jetzt posten'}
        </button>
      </form>
    </div>
  )
}
