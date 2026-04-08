import { createContext, useContext, useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInWithPopup
} from 'firebase/auth'
import { auth, googleProvider, firebaseConfigured, firebaseConfigError } from '../firebase'
import { api } from '../services/api'

const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [roles, setRoles] = useState([])

  useEffect(() => {
    if (!firebaseConfigured || !auth) {
      setLoading(false)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  async function signup(email, password) {
    if (!auth) throw new Error(firebaseConfigError || 'Firebase is not configured')
    return createUserWithEmailAndPassword(auth, email, password)
  }

  async function login(email, password) {
    if (!auth) throw new Error(firebaseConfigError || 'Firebase is not configured')
    return signInWithEmailAndPassword(auth, email, password)
  }

  async function loginWithGoogle() {
    if (!auth || !googleProvider) throw new Error(firebaseConfigError || 'Firebase is not configured')
    return signInWithPopup(auth, googleProvider)
  }

  async function logout() {
    if (!auth) return
    return signOut(auth)
  }

  async function getToken() {
    if (!user) return null
    return user.getIdToken()
  }

  useEffect(() => {
    let ignore = false
    async function loadRoles() {
      if (!user) {
        setRoles([])
        return
      }
      try {
        const me = await api.getPlatformMe()
        if (!ignore) setRoles(me.roles || [])
      } catch {
        if (!ignore) setRoles([])
      }
    }
    loadRoles()
    return () => { ignore = true }
  }, [user])

  const value = { user, loading, roles, signup, login, loginWithGoogle, logout, getToken, firebaseConfigured, firebaseConfigError }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
