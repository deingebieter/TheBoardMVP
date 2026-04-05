import { useState, useEffect, useRef } from 'react'
import api from '../api'
import useStore from '../store'
import FYPCard from '../components/FYPCard'
import PostCreator from '../components/PostCreator'
import './FYP.css'

const REGIONS = [
  { value: 'global', label: '🌍' },
  { value: 'EU', label: '🇪🇺' },
  { value: 'USA', label: '🇺🇸' },
  { value: 'DE', label: '🇩🇪' },
]

export default function FYP() {
  const region = useStore(s => s.region)
  const setRegion = useStore(s => s.setRegion)
  const [posts, setPosts] = useState([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [trending, setTrending] = useState([])
  const loadingRef = useRef(false)

  useEffect(() => {
    setPosts([])
    setPage(1)
    setHasMore(true)
    loadPosts(1, true)
    loadTrending()
  }, [region])

  const loadPosts = async (pg = page, reset = false) => {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const res = await api.get(`/fyp?page=${pg}&limit=5&region=${region}`)
      const newPosts = res.data.posts
      if (reset) setPosts(newPosts)
      else setPosts(prev => [...prev, ...newPosts])
      if (newPosts.length < 5) setHasMore(false)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
    loadingRef.current = false
  }

  const loadTrending = async () => {
    try {
      const res = await api.get('/fyp/trending/hashtags')
      setTrending(res.data.slice(0, 8))
    } catch (e) {}
  }

  const handleScroll = (e) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget
    if (scrollHeight - scrollTop <= clientHeight + 200 && hasMore && !loading) {
      const nextPage = page + 1
      setPage(nextPage)
      loadPosts(nextPage)
    }
  }

  return (
    <div className="page fyp-page">
      {/* Header */}
      <header className="fyp-header">
        <h1 className="fyp-logo neon-text-cyan">TheBoard</h1>
        <div className="region-filter">
          {REGIONS.map(r => (
            <button
              key={r.value}
              className={`region-btn ${region === r.value ? 'active' : ''}`}
              onClick={() => setRegion(r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      {/* Trending hashtags */}
      {trending.length > 0 && (
        <div className="trending-strip">
          {trending.map(tag => (
            <span key={tag.id} className="trending-tag">#{tag.name}</span>
          ))}
        </div>
      )}

      {/* Feed */}
      <div className="scroll-container fyp-feed" onScroll={handleScroll}>
        {posts.map(post => (
          <FYPCard key={post.post_id || post.ad_id} post={post} />
        ))}

        {loading && (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div className="loading-spinner" />
          </div>
        )}

        {!hasMore && posts.length > 0 && (
          <div className="end-of-feed">
            <p>🎮 Ende des Feeds</p>
            <button className="btn btn-secondary btn-sm mt-8" onClick={() => { setPosts([]); setPage(1); setHasMore(true); loadPosts(1, true) }}>
              🔄 Neu laden
            </button>
          </div>
        )}

        {!loading && posts.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🎮</div>
            <h2>Folge Hashtags!</h2>
            <p className="text-muted">Folge Hashtags in deinem Profil für personalisierte Inhalte</p>
          </div>
        )}
      </div>

      {/* FAB - Create Post */}
      <button className="fab-create" onClick={() => setShowCreate(true)}>
        <span>+</span>
      </button>

      {/* Post Creator Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal">
            <PostCreator
              type="fyp"
              onPost={(post) => setPosts(prev => [{ ...post, slot_type: 'post' }, ...prev])}
              onClose={() => setShowCreate(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
