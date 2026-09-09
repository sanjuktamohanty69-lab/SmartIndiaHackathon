import { createContext, useContext, useState } from 'react'
import client from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('user')
    return storedUser ? JSON.parse(storedUser) : null
  })

  async function login(credentials) {
    const { data } = await client.post('/auth/login', credentials)
    const token = data.token || data.accessToken

    if (token) {
      localStorage.setItem('token', token)
    }

    if (data.user) {
      localStorage.setItem('user', JSON.stringify(data.user))
      setUser(data.user)
    }

    return data
  }

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
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
