import { createContext, useContext, useState } from 'react'
import client from '../api/client'

const AuthContext = createContext(null)

function clearStoredAuth() {
  const keys = ['token', 'user', 'role']

  keys.forEach((key) => {
    localStorage.removeItem(key)
    sessionStorage.removeItem(key)
  })
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('user') || sessionStorage.getItem('user')
    return storedUser ? JSON.parse(storedUser) : null
  })

  async function login(credentials) {
    const { data } = await client.post('/auth/login', credentials)
    const token = data.token || data.accessToken

    if (token) {
      localStorage.setItem('token', token)
      sessionStorage.setItem('token', token)
    }

    if (data.user) {
      localStorage.setItem('user', JSON.stringify(data.user))
      sessionStorage.setItem('user', JSON.stringify(data.user))

      if (data.user.role) {
        localStorage.setItem('role', String(data.user.role))
        sessionStorage.setItem('role', String(data.user.role))
      }

      setUser(data.user)
    }

    return data
  }

  function logout() {
    clearStoredAuth()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
