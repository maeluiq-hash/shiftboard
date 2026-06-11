'use client'
import { useState, useEffect } from 'react'

export default function SettingsTab({ activeBizId }) {
  const [openingHours, setOpeningHours] = useState('')
  const [businessContext, setBusinessContext] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!activeBizId) return
    fetch(`/api/settings?biz=${activeBizId}`)
      .then(r => r.json())
      .then(data => {
        setOpeningHours(data.opening_hours || '')
        setBusinessContext(data.business_context || '')
      })
  }, [activeBizId])

  async function save() {
    setSaving(true)
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opening_hours: openingHours, business_context: businessContext, biz: activeBizId })
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ maxWidth: '600px' }}>
      <div style={{ background: 'white', borderRadius: '12px', border: '0.5px solid #e5e5e5', padding: '24px', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '6px' }}>Horaires d'ouverture</h3>
        <p style={{ fontSize: '13px', color: '#888', marginBottom: '14px' }}>L'IA utilisera ces horaires automatiquement pour générer les plannings.</p>
        <textarea
          value={openingHours}
          onChange={e => setOpeningHours(e.target.value)}
          placeholder={`Exemple:\nLundi - Mercredi : 10h00 - 22h00\nJeudi : 10h00 - 23h00\nVendredi : 10h00 - 03h00\nSamedi : 09h00 - 03h00\nDimanche : 10h00 - 22h00`}
          style={{ width: '100%', minHeight: '140px', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e0e0e0', fontSize: '13px', color: '#1a1a1a', resize: 'vertical', fontFamily: 'inherit' }}
        />
      </div>
      <div style={{ background: 'white', borderRadius: '12px', border: '0.5px solid #e5e5e5', padding: '24px', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '6px' }}>Informations sur l'établissement</h3>
        <p style={{ fontSize: '13px', color: '#888', marginBottom: '14px' }}>Nom du bar, règles spéciales, nb minimum d'employés par shift, etc.</p>
        <textarea
          value={businessContext}
          onChange={e => setBusinessContext(e.target.value)}
          placeholder={`Exemple:\nNom: Le Bar du Coin\nMinimum 2 employés le vendredi et samedi soir\nPas plus de 5 jours consécutifs par employé`}
          style={{ width: '100%', minHeight: '120px', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e0e0e0', fontSize: '13px', color: '#1a1a1a', resize: 'vertical', fontFamily: 'inherit' }}
        />
      </div>
      <button onClick={save} disabled={saving} style={{ padding: '10px 24px', background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
        {saving ? 'Sauvegarde...' : saved ? '✓ Sauvegardé !' : 'Sauvegarder'}
      </button>
    </div>
  )
}
