'use client'
import { useState } from 'react'

export default function DashboardClient({ profile, shifts, allShifts, employees }) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [view, setView] = useState('mes-shifts')
  const [calCopied, setCalCopied] = useState(false)

  const today = new Date()
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7)

  const weekDates = Array.from({length: 7}, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().split('T')[0]
  })

  const weekLabel = `${monday.getDate()} ${monday.toLocaleString('fr-FR', {month:'long'})} – ${new Date(weekDates[6]).getDate()} ${new Date(weekDates[6]).toLocaleString('fr-FR', {month:'long', year:'numeric'})}`

  const myWeekShifts = weekDates.map(date => ({
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

  const EMP_COLORS = [
    { bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8' },
    { bg: '#F5F3FF', border: '#DDD6FE', text: '#6D28D9' },
    { bg: '#ECFDF5', border: '#A7F3D0', text: '#065F46' },
    { bg: '#FFF7ED', border: '#FED7AA', text: '#C2410C' },
    { bg: '#FDF2F8', border: '#F9A8D4', text: '#9D174D' },
    { bg: '#F0FDFA', border: '#99F6E4', text: '#0F766E' },
    { bg: '#FEFCE8', border: '#FDE68A', text: '#92400E' },
    { bg: '#EEF2FF', border: '#C7D2FE', text: '#3730A3' },
  ]

  const initials = profile?.full_name?.split(' ').map(n=>n[0]).join('').slice(0,2) || '?'

  function getEmpColor(empId) {
    const idx = employees.findIndex(e => e.id === empId)
    return EMP_COLORS[Math.max(0, idx) % EMP_COLORS.length]
  }

  function getEmpName(empId) {
    return employees.find(e => e.id === empId)?.full_name || '?'
  }

  function getDayColleagues(date) {
    return allShifts.filter(s => s.date === date && s.employee_id !== profile?.id)
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const calUrl = `${baseUrl}/api/calendar?employee_id=${profile?.id}`

  function copyCalLink() {
    navigator.clipboard.writeText(calUrl)
    setCalCopied(true)
    setTimeout(() => setCalCopied(false), 2000)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #F0F4F8; font-family: 'Inter', -apple-system, sans-serif; color: #111827; }

        .emp-wrap { max-width: 720px; margin: 0 auto; padding: 20px 16px; }

        .emp-nav { background: white; border-radius: 20px; padding: 14px 20px; display: flex; align-items: center; gap: 12px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04); }
        .emp-logo { width: 38px; height: 38px; background: linear-gradient(135deg, #1D9E75, #0F6E56); border-radius: 11px; display: flex; align-items: center; justify-content: center; color: white; font-size: 18px; flex-shrink: 0; box-shadow: 0 4px 12px rgba(29,158,117,0.3); }
        .emp-appname { font-size: 16px; font-weight: 700; color: #111827; }
        .emp-nav-right { margin-left: auto; display: flex; align-items: center; gap: 10px; }
        .emp-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #1D9E75, #0F6E56); display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: 700; flex-shrink: 0; }
        .emp-name-nav { font-size: 13px; font-weight: 500; color: #374151; }
        .emp-logout { padding: 6px 14px; background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 9px; font-size: 12px; color: #6B7280; cursor: pointer; }

        .emp-hero { background: linear-gradient(135deg, #1D9E75, #0D8B65, #0F6E56); border-radius: 20px; padding: 24px; margin-bottom: 20px; box-shadow: 0 8px 30px rgba(29,158,117,0.3); position: relative; overflow: hidden; }
        .emp-hero::before { content: ''; position: absolute; top: -40px; right: -40px; width: 140px; height: 140px; background: rgba(255,255,255,0.06); border-radius: 50%; }
        .emp-hero-label { font-size: 11px; color: rgba(255,255,255,0.7); font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 6px; }
        .emp-hero-time { font-size: 32px; font-weight: 800; color: white; letter-spacing: -1px; line-height: 1; margin-bottom: 6px; }
        .emp-hero-date { font-size: 14px; color: rgba(255,255,255,0.8); font-weight: 500; }
        .emp-hero-badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.2); border-radius: 20px; padding: 4px 12px; font-size: 12px; color: white; font-weight: 600; margin-top: 12px; }

        .emp-cal-card { background: white; border-radius: 16px; padding: 16px 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04); display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
        .emp-cal-icon { width: 40px; height: 40px; background: linear-gradient(135deg, #EFF6FF, #DBEAFE); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
        .emp-cal-title { font-size: 14px; font-weight: 700; color: #111827; margin-bottom: 2px; }
        .emp-cal-sub { font-size: 12px; color: #9CA3AF; }
        .emp-cal-actions { margin-left: auto; display: flex; gap: 8px; flex-wrap: wrap; }
        .emp-cal-btn { padding: 7px 14px; border-radius: 10px; font-size: 12px; font-weight: 600; cursor: pointer; border: none; transition: all 0.15s; white-space: nowrap; }
        .emp-cal-btn-primary { background: linear-gradient(135deg, #1D9E75, #0F6E56); color: white; box-shadow: 0 4px 12px rgba(29,158,117,0.25); }
        .emp-cal-btn-primary:hover { transform: translateY(-1px); }
        .emp-cal-btn-secondary { background: #F3F4F6; color: #374151; }
        .emp-cal-btn-secondary:hover { background: #E5E7EB; }
        .emp-cal-btn-copied { background: #DCFCE7; color: #065F46; }

        .emp-tabs { display: flex; gap: 4px; background: white; border-radius: 14px; padding: 5px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04); }
        .emp-tab { flex: 1; padding: 8px 12px; border-radius: 10px; border: none; font-size: 13px; cursor: pointer; background: transparent; color: #6B7280; font-weight: 500; transition: all 0.2s; text-align: center; }
        .emp-tab.active { background: linear-gradient(135deg, #1D9E75, #0F6E56); color: white; box-shadow: 0 4px 12px rgba(29,158,117,0.3); }

        .emp-card { background: white; border-radius: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04); overflow: hidden; margin-bottom: 16px; }
        .emp-card-header { padding: 16px 20px; border-bottom: 1px solid #F3F4F6; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
        .emp-card-title { font-size: 14px; font-weight: 700; color: #111827; }

        .emp-week-nav { display: flex; align-items: center; gap: 8px; }
        .emp-nav-btn { width: 30px; height: 30px; border-radius: 9px; border: 1px solid #E5E7EB; background: white; cursor: pointer; font-size: 15px; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
        .emp-week-lbl { font-size: 12px; font-weight: 600; color: #6B7280; }
        .emp-today-link { font-size: 11px; color: #1D9E75; background: #ECFDF5; border: none; border-radius: 6px; padding: 4px 10px; cursor: pointer; font-weight: 600; }

        .emp-day-row { display: flex; align-items: flex-start; padding: 14px 20px; border-bottom: 1px solid #F9FAFB; transition: background 0.1s; }
        .emp-day-row:last-child { border-bottom: none; }
        .emp-day-row.is-today { background: linear-gradient(135deg, #F0FDF4, #ECFDF5); }
        .emp-date-col { width: 54px; text-align: center; flex-shrink: 0; padding-top: 2px; }
        .emp-date-wd { font-size: 10px; color: #9CA3AF; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; }
        .emp-date-num { font-size: 22px; font-weight: 800; color: #374151; line-height: 1.1; }
        .emp-date-num.today { color: #1D9E75; }
        .emp-date-mo { font-size: 10px; color: #9CA3AF; }
        .emp-shift-col { flex: 1; margin-left: 16px; }
        .emp-shift-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; border: 1.5px solid transparent; margin-bottom: 6px; }
        .emp-today-tag { font-size: 11px; color: #1D9E75; font-weight: 700; background: #DCFCE7; padding: 3px 8px; border-radius: 10px; margin-left: 6px; }
        .emp-repos { font-size: 13px; color: #D1D5DB; font-weight: 500; }
        .emp-colleagues { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
        .emp-colleague-chip { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; border: 1.5px solid transparent; }

        .team-day { padding: 16px 20px; border-bottom: 1px solid #F9FAFB; }
        .team-day:last-child { border-bottom: none; }
        .team-day-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .team-day-date { font-size: 13px; font-weight: 700; color: #374151; }
        .team-day-today { font-size: 11px; color: #1D9E75; font-weight: 700; background: #DCFCE7; padding: 2px 8px; border-radius: 10px; }
        .team-day-empty { font-size: 12px; color: #D1D5DB; font-style: italic; }
        .team-emp-row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
        .team-emp-av { width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 800; flex-shrink: 0; }
        .team-emp-name { font-size: 13px; font-weight: 600; flex: 1; }
        .team-emp-shift { display: inline-flex; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; border: 1.5px solid transparent; }
        .team-me-badge { font-size: 10px; color: #1D9E75; background: #DCFCE7; padding: 2px 6px; border-radius: 6px; font-weight: 700; margin-left: 4px; }

        @media (max-width: 480px) {
          .emp-wrap { padding: 14px 12px; }
          .emp-hero-time { font-size: 26px; }
          .emp-name-nav { display: none; }
          .emp-cal-actions { width: 100%; }
          .emp-cal-btn { flex: 1; text-align: center; }
        }
      `}</style>

      <div className="emp-wrap">
        <nav className="emp-nav">
          <div className="emp-logo">⚡</div>
          <span className="emp-appname">ShiftBoard</span>
          <div className="emp-nav-right">
            <div className="emp-avatar">{initials}</div>
            <span className="emp-name-nav">{profile?.full_name}</span>
            <form action="/api/logout" method="POST" style={{display:'inline'}}>
              <button type="submit" className="emp-logout">Déconnexion</button>
            </form>
          </div>
        </nav>

        {nextShift && weekOffset === 0 && view === 'mes-shifts' && (
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
        )}

        <div className="emp-cal-card">
          <div className="emp-cal-icon">📅</div>
          <div style={{flex:1, minWidth:0}}>
            <div className="emp-cal-title">Synchroniser mon calendrier</div>
            <div className="emp-cal-sub">Ajoute tes shifts à Apple Calendar ou Google Calendar</div>
          </div>
          <div className="emp-cal-actions">
            <a href={calUrl} className="emp-cal-btn emp-cal-btn-primary" download="shiftboard.ics">
              ↓ Télécharger
            </a>
            <button className={`emp-cal-btn ${calCopied ? 'emp-cal-btn-copied' : 'emp-cal-btn-secondary'}`} onClick={copyCalLink}>
              {calCopied ? '✓ Copié !' : '🔗 Copier le lien'}
            </button>
          </div>
        </div>

        <div className="emp-tabs">
          <button className={`emp-tab${view==='mes-shifts'?' active':''}`} onClick={() => setView('mes-shifts')}>📅 Mes horaires</button>
          <button className={`emp-tab${view==='equipe'?' active':''}`} onClick={() => setView('equipe')}>👥 Mon équipe</button>
        </div>

        <div className="emp-card">
          <div className="emp-card-header">
            <span className="emp-card-title">{view === 'mes-shifts' ? 'Ma semaine' : "Planning de l'équipe"}</span>
            <div className="emp-week-nav">
              <button className="emp-nav-btn" onClick={() => setWeekOffset(w => w-1)}>‹</button>
              <span className="emp-week-lbl">{weekLabel}</span>
              <button className="emp-nav-btn" onClick={() => setWeekOffset(w => w+1)}>›</button>
              {weekOffset !== 0 && <button className="emp-today-link" onClick={() => setWeekOffset(0)}>Auj.</button>}
            </div>
          </div>

          {view === 'mes-shifts' && myWeekShifts.map(({ date, shift }) => {
            const d = new Date(date + 'T12:00:00')
            const isToday = date === today.toISOString().split('T')[0]
            const c = shift ? (colors[shift.shift_type] || colors.custom) : null
            const colleagues = getDayColleagues(date)
            return (
              <div key={date} className={`emp-day-row${isToday ? ' is-today' : ''}`}>
                <div className="emp-date-col">
                  <div className="emp-date-wd">{d.toLocaleDateString('fr-FR', { weekday: 'short' })}</div>
                  <div className={`emp-date-num${isToday ? ' today' : ''}`}>{d.getDate()}</div>
                  <div className="emp-date-mo">{d.toLocaleDateString('fr-FR', { month: 'short' })}</div>
                </div>
                <div className="emp-shift-col">
                  {shift ? (
                    <>
                      <div style={{display:'flex', alignItems:'center', flexWrap:'wrap', gap:'4px'}}>
                        <span className="emp-shift-badge" style={{background:c.bg, borderColor:c.border, color:c.color}}>
                          {shift.start_time.slice(0,5)} – {shift.end_time.slice(0,5)}
                        </span>
                        {isToday && <span className="emp-today-tag">Aujourd'hui</span>}
                      </div>
                      {colleagues.length > 0 && (
                        <div className="emp-colleagues">
                          {colleagues.map(col => {
                            const ec = getEmpColor(col.employee_id)
                            return (
                              <span key={col.id} className="emp-colleague-chip" style={{background:ec.bg, borderColor:ec.border, color:ec.text}}>
                                {getEmpName(col.employee_id).split(' ')[0]}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="emp-repos">Repos</span>
                  )}
                </div>
              </div>
            )
          })}

          {view === 'equipe' && weekDates.map(date => {
            const d = new Date(date + 'T12:00:00')
            const isToday = date === today.toISOString().split('T')[0]
            const dayShifts = allShifts.filter(s => s.date === date)
            return (
              <div key={date} className="team-day">
                <div className="team-day-header">
                  <span className="team-day-date">
                    {d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </span>
                  {isToday && <span className="team-day-today">Aujourd'hui</span>}
                  {dayShifts.length === 0 && <span className="team-day-empty">Aucun shift</span>}
                </div>
                {dayShifts.map(s => {
                  const ec = getEmpColor(s.employee_id)
                  const c = colors[s.shift_type] || colors.custom
                  const isMe = s.employee_id === profile?.id
                  return (
                    <div key={s.id} className="team-emp-row">
                      <div className="team-emp-av" style={{background:ec.bg, color:ec.text, border:`1.5px solid ${ec.border}`}}>
                        {getEmpName(s.employee_id).split(' ').map(n=>n[0]).join('').slice(0,2)}
                      </div>
                      <span className="team-emp-name">
                        {getEmpName(s.employee_id).split(' ')[0]}
                        {isMe && <span className="team-me-badge">Moi</span>}
                      </span>
                      <span className="team-emp-shift" style={{background:c.bg, borderColor:c.border, color:c.color}}>
                        {s.start_time.slice(0,5)} – {s.end_time.slice(0,5)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
