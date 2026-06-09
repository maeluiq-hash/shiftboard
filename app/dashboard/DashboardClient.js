'use client'
import { useState } from 'react'

export default function DashboardClient({ profile, shifts }) {
  const [weekOffset, setWeekOffset] = useState(0)

  const today = new Date()
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7)

  const weekDates = Array.from({length: 7}, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().split('T')[0]
  })

  const weekLabel = `${monday.getDate()} ${monday.toLocaleString('fr-FR', {month:'long'})} – ${new Date(weekDates[6]).getDate()} ${new Date(weekDates[6]).toLocaleString('fr-FR', {month:'long', year:'numeric'})}`

  const weekShifts = weekDates.map(date => ({
    date,
    shift: shifts.find(s => s.date === date)
  }))

  const nextShift = shifts.find(s => s.date >= today.toISOString().split('T')[0])

  const colors = {
    matin: { bg: '#ECFDF5', border: '#A7F3D0', color: '#065F46' },
    soir: { bg: '#EFF6FF', border: '#BFDBFE', color: '#1D4ED8' },
    coupure: { bg: '#FFF7ED', border: '#FED7AA', color: '#C2410C' },
    custom: { bg: '#F5F3FF', border: '#DDD6FE', color: '#6D28D9' },
  }

  const initials = profile?.full_name?.split(' ').map(n=>n[0]).join('').slice(0,2) || '?'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #F0F4F8; font-family: 'Inter', -apple-system, sans-serif; color: #111827; }
        input, textarea { color: #111827 !important; font-family: 'Inter', sans-serif; }

        .emp-wrap { max-width: 680px; margin: 0 auto; padding: 20px 16px; }

        .emp-nav { background: white; border-radius: 20px; padding: 14px 20px; display: flex; align-items: center; gap: 12px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04); }
        .emp-logo { width: 38px; height: 38px; background: linear-gradient(135deg, #1D9E75, #0F6E56); border-radius: 11px; display: flex; align-items: center; justify-content: center; color: white; font-size: 18px; flex-shrink: 0; box-shadow: 0 4px 12px rgba(29,158,117,0.3); }
        .emp-appname { font-size: 16px; font-weight: 700; color: #111827; }
        .emp-nav-right { margin-left: auto; display: flex; align-items: center; gap: 10px; }
        .emp-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #1D9E75, #0F6E56); display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: 700; flex-shrink: 0; }
        .emp-name { font-size: 13px; font-weight: 500; color: #374151; }
        .emp-logout { padding: 6px 14px; background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 9px; font-size: 12px; color: #6B7280; cursor: pointer; font-weight: 500; transition: all 0.15s; }
        .emp-logout:hover { background: #F3F4F6; }

        .emp-hero { background: linear-gradient(135deg, #1D9E75, #0D8B65, #0F6E56); border-radius: 20px; padding: 24px; margin-bottom: 20px; box-shadow: 0 8px 30px rgba(29,158,117,0.3); position: relative; overflow: hidden; }
        .emp-hero::before { content: ''; position: absolute; top: -40px; right: -40px; width: 140px; height: 140px; background: rgba(255,255,255,0.06); border-radius: 50%; }
        .emp-hero::after { content: ''; position: absolute; bottom: -20px; left: -20px; width: 80px; height: 80px; background: rgba(255,255,255,0.04); border-radius: 50%; }
        .emp-hero-label { font-size: 12px; color: rgba(255,255,255,0.7); font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 6px; }
        .emp-hero-time { font-size: 32px; font-weight: 800; color: white; letter-spacing: -1px; line-height: 1; margin-bottom: 6px; }
        .emp-hero-date { font-size: 14px; color: rgba(255,255,255,0.8); font-weight: 500; }
        .emp-hero-badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.2); border-radius: 20px; padding: 4px 12px; font-size: 12px; color: white; font-weight: 600; margin-top: 12px; backdrop-filter: blur(4px); }

        .emp-card { background: white; border-radius: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04); overflow: hidden; margin-bottom: 16px; }
        .emp-card-header { padding: 16px 20px; border-bottom: 1px solid #F3F4F6; display: flex; align-items: center; justify-content: space-between; }
        .emp-card-title { font-size: 14px; font-weight: 700; color: #111827; }

        .emp-week-nav { display: flex; align-items: center; gap: 8px; }
        .emp-nav-btn { width: 30px; height: 30px; border-radius: 9px; border: 1px solid #E5E7EB; background: white; cursor: pointer; font-size: 15px; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
        .emp-nav-btn:hover { background: #F9FAFB; border-color: #D1D5DB; }
        .emp-week-lbl { font-size: 12px; font-weight: 600; color: #6B7280; }
        .emp-today-link { font-size: 11px; color: #1D9E75; background: #ECFDF5; border: none; border-radius: 6px; padding: 4px 10px; cursor: pointer; font-weight: 600; }

        .emp-day-row { display: flex; align-items: center; padding: 14px 20px; border-bottom: 1px solid #F9FAFB; transition: background 0.1s; }
        .emp-day-row:last-child { border-bottom: none; }
        .emp-day-row:hover { background: #FAFAFA; }
        .emp-day-row.is-today { background: linear-gradient(135deg, #F0FDF4, #ECFDF5); }
        .emp-date-col { width: 54px; text-align: center; flex-shrink: 0; }
        .emp-date-wd { font-size: 10px; color: #9CA3AF; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; }
        .emp-date-num { font-size: 24px; font-weight: 800; color: #374151; line-height: 1.1; letter-spacing: -0.5px; }
        .emp-date-num.today { color: #1D9E75; }
        .emp-date-mo { font-size: 10px; color: #9CA3AF; font-weight: 500; }
        .emp-shift-info { flex: 1; margin-left: 18px; }
        .emp-shift-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; border: 1.5px solid transparent; }
        .emp-today-tag { font-size: 11px; color: #1D9E75; font-weight: 700; background: #DCFCE7; padding: 3px 8px; border-radius: 10px; margin-left: 8px; }
        .emp-repos { font-size: 13px; color: #D1D5DB; font-weight: 500; }

        .emp-empty { padding: 40px 20px; text-align: center; color: #9CA3AF; }
        .emp-empty-icon { font-size: 40px; margin-bottom: 10px; }
        .emp-empty-text { font-size: 14px; font-weight: 500; }

        @media (max-width: 480px) {
          .emp-wrap { padding: 14px 12px; }
          .emp-hero-time { font-size: 28px; }
          .emp-name { display: none; }
        }
      `}</style>

      <div className="emp-wrap">
        <nav className="emp-nav">
          <div className="emp-logo">⚡</div>
          <span className="emp-appname">ShiftBoard</span>
          <div className="emp-nav-right">
            <div className="emp-avatar">{initials}</div>
            <span className="emp-name">{profile?.full_name}</span>
            <form action="/api/logout" method="POST" style={{display:'inline'}}>
              <button type="submit" className="emp-logout">Déconnexion</button>
            </form>
          </div>
        </nav>

        {nextShift ? (
          <div className="emp-hero">
            <div className="emp-hero-label">Prochain shift</div>
            <div className="emp-hero-time">{nextShift.start_time.slice(0,5)} – {nextShift.end_time.slice(0,5)}</div>
            <div className="emp-hero-date">
              {new Date(nextShift.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            {nextShift.date === today.toISOString().split('T')[0] && (
              <div className="emp-hero-badge">⚡ C'est aujourd'hui !</div>
            )}
          </div>
        ) : (
          <div style={{background:'white', borderRadius:'20px', padding:'24px', marginBottom:'20px', textAlign:'center', boxShadow:'0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)'}}>
            <div style={{fontSize:'32px', marginBottom:'8px'}}>🌴</div>
            <div style={{fontSize:'15px', fontWeight:'700', color:'#374151', marginBottom:'4px'}}>Aucun shift à venir</div>
            <div style={{fontSize:'13px', color:'#9CA3AF'}}>Profite, le planning n'est pas encore publié !</div>
          </div>
        )}

        <div className="emp-card">
          <div className="emp-card-header">
            <span className="emp-card-title">Planning de la semaine</span>
            <div className="emp-week-nav">
              <button className="emp-nav-btn" onClick={() => setWeekOffset(w => w-1)}>‹</button>
              <span className="emp-week-lbl">{weekLabel}</span>
              <button className="emp-nav-btn" onClick={() => setWeekOffset(w => w+1)}>›</button>
              {weekOffset !== 0 && <button className="emp-today-link" onClick={() => setWeekOffset(0)}>Auj.</button>}
            </div>
          </div>

          {weekShifts.map(({ date, shift }) => {
            const d = new Date(date + 'T12:00:00')
            const isToday = date === today.toISOString().split('T')[0]
            const c = shift ? (colors[shift.shift_type] || colors.custom) : null
            return (
              <div key={date} className={`emp-day-row${isToday ? ' is-today' : ''}`}>
                <div className="emp-date-col">
                  <div className="emp-date-wd">{d.toLocaleDateString('fr-FR', { weekday: 'short' })}</div>
                  <div className={`emp-date-num${isToday ? ' today' : ''}`}>{d.getDate()}</div>
                  <div className="emp-date-mo">{d.toLocaleDateString('fr-FR', { month: 'short' })}</div>
                </div>
                <div className="emp-shift-info">
                  {shift ? (
                    <div style={{display:'flex', alignItems:'center', flexWrap:'wrap', gap:'6px'}}>
                      <span className="emp-shift-badge" style={{background:c.bg, borderColor:c.border, color:c.color}}>
                        {shift.start_time.slice(0,5)} – {shift.end_time.slice(0,5)}
                      </span>
                      {isToday && <span className="emp-today-tag">Aujourd'hui</span>}
                    </div>
                  ) : (
                    <span className="emp-repos">Repos</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
