import { useState, useEffect, useRef } from 'react'
import api from '../api'
import useStore from '../store'
import MainfeedCard from '../components/MainfeedCard'
import PostCreator from '../components/PostCreator'
import './Mainfeed.css'

export default function Mainfeed() {
  const region = useStore(s => s.region)
  const [posts, setPosts] = useState([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const loadingRef = useRef(false)

  useEffect(() => {
    setPosts([])
    setPage(1)
    setHasMore(true)
    loadPosts(1, true)
  }, [region])

  const loadPosts = async (pg = 1, reset = false) => {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const res = await api.get(`/mainfeed?page=${pg}&limit=20&region=${region}`)
      const newPosts = res.data.posts
      if (reset) setPosts(newPosts)
      else setPosts(prev => [...prev, ...newPosts])
      if (newPosts.filter(p => p.slot_type === 'post').length < 20) setHasMore(false)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
    loadingRef.current = false
  }

  const handleScroll = (e) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget
    if (scrollHeight - scrollTop <= clientHeight + 300 && hasMore && !loading) {
      const next = page + 1
      setPage(next)
      loadPosts(next)
    }
  }

  return (
    <div className="page mainfeed-page">
      <header className="feed-header">
        <h1 className="font-mono neon-text-pink" style={{ fontSize: '1.2rem' }}>📢 Mainfeed</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ Post</button>
      </header>

      <div className="scroll-container" onScroll={handleScroll}>
        <div className="feed-list" style={{ padding: '12px 16px' }}>
          {posts.map(post => (
            <MainfeedCard key={post.post_id || post.ad_id} post={post} />
          ))}

          {loading && <div className="loading-spinner" />}

          {!loading && posts.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">📢</div>
              <h2>Noch keine Posts</h2>
              <p className="text-muted">Folge anderen Nutzern oder erstelle deinen ersten Post!</p>
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal">
            <PostCreator
              type="mainfeed"
              onPost={(post) => setPosts(prev => [{ ...post, slot_type: 'post' }, ...prev])}
              onClose={() => setShowCreate(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
