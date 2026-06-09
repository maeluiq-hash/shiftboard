'use client'
import { useState } from 'react'
import { createClient } from '../../utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleRegister(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: authError } = await supabase.auth.signUp({ email, password })
    if (authError) { setError(authError.message); setLoading(false); return }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      email,
      full_name: fullName,
      role: 'pending'
    })

    if (profileError) { setError(profileError.message); setLoading(false); return }

    setSuccess(true)
    setLoading(false)
  }

  if (success) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f8f7' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '48px', width: '100%', maxWidth: '400px', border: '0.5px solid #e5e5e5', textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '16px' }}>✅</div>
        <h2 style={{ fontSize: '18px', fontWeight: '500', margin: '0 0 8px' }}>Compte créé !</h2>
        <p style={{ color: '#888', fontSize: '14px', margin: '0 0 24px' }}>Ton compte est en attente de validation par l'admin.</p>
        <button onClick={() => router.push('/login')} style={{ padding: '10px 24px', background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>
          Retour à la connexion
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f8f7' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '48px', width: '100%', maxWidth: '400px', border: '0.5px solid #e5e5e5' }}>
        <div style={{ marginBottom: '32px' }}>
          <div style={{ width: '40px', height: '40px', background: '#1D9E75', borderRadius: '10px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'white', fontSize: '20px' }}>⚡</span>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: '500', margin: '0 0 4px' }}>Créer un compte</h1>
          <p style={{ color: '#888', fontSize: '14px', margin: 0 }}>ShiftBoard — Rejoins ton équipe</p>
        </div>
        <form onSubmit={handleRegister}>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', color: '#555', marginBottom: '6px' }}>Nom complet</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="Prénom Nom" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '0.5px solid #ddd', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', color: '#555', marginBottom: '6px' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '0.5px solid #ddd', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '13px', color: '#555', marginBottom: '6px' }}>Mot de passe</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '0.5px solid #ddd', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          {error && <p style={{ color: '#E24B4A', fontSize: '13px', marginBottom: '16px' }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px', background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', marginBottom: '12px' }}>
            {loading ? 'Création...' : 'Créer mon compte'}
          </button>
          <p style={{ textAlign: 'center', fontSize: '13px', color: '#888', margin: 0 }}>
            Déjà un compte ? <span onClick={() => router.push('/login')} style={{ color: '#1D9E75', cursor: 'pointer', fontWeight: '500' }}>Se connecter</span>
          </p>
        </form>
      </div>
    </div>
  )
}
