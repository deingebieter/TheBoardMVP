import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from './api'

const useStore = create(
  persist(
    (set, get) => ({
      // Auth
      token: null,
      user: null,
      isLoggedIn: false,

      setAuth: (token, user) => set({ token, user, isLoggedIn: true }),
      logout: () => {
        set({ token: null, user: null, isLoggedIn: false })
        localStorage.removeItem('theboard-storage')
      },
      updateUser: (updates) => set(state => ({ user: { ...state.user, ...updates } })),

      // UI
      toast: null,
      showToast: (message, duration = 2500) => {
        set({ toast: message })
        setTimeout(() => set({ toast: null }), duration)
      },

      // Settings
      bgMusicEnabled: false,
      toggleBgMusic: () => set(state => ({ bgMusicEnabled: !state.bgMusicEnabled })),

      // Filter
      region: 'global',
      setRegion: (region) => set({ region }),
    }),
    {
      name: 'theboard-storage',
      partialize: (state) => ({ token: state.token, user: state.user, isLoggedIn: state.isLoggedIn, bgMusicEnabled: state.bgMusicEnabled, region: state.region })
    }
  )
)

export default useStore
