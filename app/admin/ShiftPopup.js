'use client'
import { useState } from 'react'

export default function ShiftPopup({ popup, onClose, onApply }) {
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('17:00')

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '14px', padding: '24px', width: '280px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
        <p style={{ fontSize: '13px', fontWeight: '500', margin: '0 0 4px' }}>{popup.emp.full_name}</p>
        <p style={{ fontSize: '12px', color: '#888', margin: '0 0 20px' }}>
          {new Date(popup.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#555', marginBottom: '6px' }}>Début</label>
            <input type="time" value={start} onChange={e => setStart(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '0.5px solid #ddd', fontSize: '15px', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#555', marginBottom: '6px' }}>Fin</label>
            <input type="time" value={end} onChange={e => setEnd(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '0.5px solid #ddd', fontSize: '15px', boxSizing: 'border-box' }} />
          </div>
        </div>

        <button onClick={() => onApply({ type: 'custom', start: start + ':00', end: end + ':00' })} style={{ width: '100%', padding: '12px', background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', marginBottom: '8px' }}>
          Appliquer — {start} à {end}
        </button>

        <button onClick={() => onApply({ type: 'repos' })} style={{ width: '100%', padding: '10px', background: 'none', color: '#aaa', border: 'none', fontSize: '13px', cursor: 'pointer' }}>
          Supprimer le shift
        </button>
      </div>
    </div>
  )
}
