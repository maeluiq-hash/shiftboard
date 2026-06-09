'use client'
import { useState } from 'react'
import { createClient } from '../../utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email ou mot de passe incorrect')
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f8f7' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '48px', width: '100%', maxWidth: '400px', border: '0.5px solid #e5e5e5' }}>
        <div style={{ marginBottom: '32px' }}>
          <div style={{ width: '40px', height: '40px', background: '#1D9E75', borderRadius: '10px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'white', fontSize: '20px' }}>⚡</span>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: '500', margin: '0 0 4px' }}>ShiftBoard</h1>
          <p style={{ color: '#888', fontSize: '14px', margin: 0 }}>Connecte-toi pour voir tes horaires</p>
        </div>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', color: '#555', marginBottom: '6px' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '0.5px solid #ddd', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '13px', color: '#555', marginBottom: '6px' }}>Mot de passe</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '0.5px solid #ddd', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          {error && <p style={{ color: '#E24B4A', fontSize: '13px', marginBottom: '16px' }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px', background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', marginBottom: '12px' }}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
          <p style={{ textAlign: 'center', fontSize: '13px', color: '#888', margin: 0 }}>
            Pas encore de compte ? <span onClick={() => router.push('/register')} style={{ color: '#1D9E75', cursor: 'pointer', fontWeight: '500' }}>S'inscrire</span>
          </p>
        </form>
      </div>
    </div>
  )
}
