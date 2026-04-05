import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import useStore from './store'

import BottomNav from './components/BottomNav'
import Toast from './components/Toast'
import Login from './pages/Login'
import Register from './pages/Register'
import FYP from './pages/FYP'
import Mainfeed from './pages/Mainfeed'
import Discussions from './pages/Discussions'
import DiscussionDetail from './pages/DiscussionDetail'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import Competitions from './pages/Competitions'

function PrivateRoute({ children }) {
  const isLoggedIn = useStore(s => s.isLoggedIn)
  return isLoggedIn ? children : <Navigate to="/login" replace />
}

function App() {
  const toast = useStore(s => s.toast)
  const bgMusicEnabled = useStore(s => s.bgMusicEnabled)
  const audioRef = useRef(null)

  useEffect(() => {
    // Arcade music placeholder - would load actual audio file
    if (bgMusicEnabled && !audioRef.current) {
      // In production, load a real 90s arcade tune
      console.log('[Audio] Background music enabled')
    }
  }, [bgMusicEnabled])

  return (
    <BrowserRouter>
      <div className="scanlines">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<PrivateRoute><FYP /></PrivateRoute>} />
          <Route path="/mainfeed" element={<PrivateRoute><Mainfeed /></PrivateRoute>} />
          <Route path="/discussions" element={<PrivateRoute><Discussions /></PrivateRoute>} />
          <Route path="/discussions/:id" element={<PrivateRoute><DiscussionDetail /></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
          <Route path="/profile/:user_id" element={<Profile />} />
          <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
          <Route path="/competitions" element={<PrivateRoute><Competitions /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        {/* Bottom navigation for authenticated pages */}
        <BottomNavWrapper />

        {toast && <Toast message={toast} />}
      </div>
    </BrowserRouter>
  )
}

function BottomNavWrapper() {
  const isLoggedIn = useStore(s => s.isLoggedIn)
  if (!isLoggedIn) return null
  return <BottomNav />
}

export default App
