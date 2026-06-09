'use client'
import { useState } from 'react'

export default function ShiftPopup({ popup, onClose, onApply, onDelete }) {
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('17:00')

  const existingShifts = popup.existingShifts || []

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '20px', padding: '24px', width: '100%', maxWidth: '340px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        
        <p style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '2px' }}>{popup.emp.full_name}</p>
        <p style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '20px' }}>
          {new Date(popup.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>

        {existingShifts.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Créneaux existants</p>
            {existingShifts.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#F9FAFB', borderRadius: '10px', padding: '8px 12px', marginBottom: '6px' }}>
                <span style={{ flex: 1, fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                  {s.start_time.slice(0,5)} – {s.end_time.slice(0,5)}
                </span>
                <button onClick={() => onDelete(s.id)} style={{ width: '26px', height: '26px', borderRadius: '8px', border: '1px solid #FECACA', background: '#FEF2F2', color: '#EF4444', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
              </div>
            ))}
          </div>
        )}

        <p style={{ fontSize: '11px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
          {existingShifts.length > 0 ? 'Ajouter un créneau' : 'Nouveau créneau'}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#9CA3AF', marginBottom: '5px', fontWeight: '600' }}>Début</label>
            <input type="time" value={start} onChange={e => setStart(e.target.value)} style={{ width: '100%', padding: '9px', borderRadius: '10px', border: '1.5px solid #E5E7EB', fontSize: '14px', color: '#111827', boxSizing: 'border-box', background: '#FAFAFA' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#9CA3AF', marginBottom: '5px', fontWeight: '600' }}>Fin</label>
            <input type="time" value={end} onChange={e => setEnd(e.target.value)} style={{ width: '100%', padding: '9px', borderRadius: '10px', border: '1.5px solid #E5E7EB', fontSize: '14px', color: '#111827', boxSizing: 'border-box', background: '#FAFAFA' }} />
          </div>
        </div>

        <button onClick={() => onApply({ type: 'custom', start: start + ':00', end: end + ':00' })} style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg, #1D9E75, #0F6E56)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', marginBottom: '8px', boxShadow: '0 4px 12px rgba(29,158,117,0.25)' }}>
          Ajouter {start} – {end}
        </button>

        {existingShifts.length > 0 && (
          <button onClick={() => { existingShifts.forEach(s => onDelete(s.id)); onClose() }} style={{ width: '100%', padding: '10px', background: 'white', color: '#EF4444', border: '1px solid #FECACA', borderRadius: '12px', fontSize: '13px', cursor: 'pointer', marginBottom: '8px' }}>
            Supprimer tous les créneaux
          </button>
        )}

        <button onClick={onClose} style={{ width: '100%', padding: '10px', background: 'none', color: '#9CA3AF', border: 'none', fontSize: '13px', cursor: 'pointer' }}>
          Fermer
        </button>
      </div>
    </div>
  )
}
