'use client'
import { useState } from 'react'
import ShiftPopup from './ShiftPopup'
import SettingsTab from './SettingsTab'

const EMP_COLORS = [
  { bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8', dot: '#3B82F6' },
  { bg: '#F5F3FF', border: '#DDD6FE', text: '#6D28D9', dot: '#8B5CF6' },
  { bg: '#ECFDF5', border: '#A7F3D0', text: '#065F46', dot: '#10B981' },
  { bg: '#FFF7ED', border: '#FED7AA', text: '#C2410C', dot: '#F97316' },
  { bg: '#FDF2F8', border: '#F9A8D4', text: '#9D174D', dot: '#EC4899' },
  { bg: '#F0FDFA', border: '#99F6E4', text: '#0F766E', dot: '#14B8A6' },
  { bg: '#FEFCE8', border: '#FDE68A', text: '#92400E', dot: '#F59E0B' },
  { bg: '#EEF2FF', border: '#C7D2FE', text: '#3730A3', dot: '#6366F1' },
]

function getDuration(start, end) {
  const [sh, sm] = start.slice(0,5).split(':').map(Number)
  const [eh, em] = end.slice(0,5).split(':').map(Number)
  let mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins < 0) mins += 24 * 60
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h${m.toString().padStart(2,'0')}` : `${h}h`
}

function getTotalHours(shifts) {
  let total = 0
  shifts.forEach(s => {
    const [sh, sm] = s.start_time.slice(0,5).split(':').map(Number)
    const [eh, em] = s.end_time.slice(0,5).split(':').map(Number)
    let mins = (eh * 60 + em) - (sh * 60 + sm)
    if (mins < 0) mins += 24 * 60
    total += mins
  })
  const h = Math.floor(total / 60)
  const m = total % 60
  return m > 0 ? `${h}h${m.toString().padStart(2,'0')}` : `${h}h`
}

export default function AdminClient({ profile, employees, shifts: initialShifts, pending }) {
  const [tab, setTab] = useState('planning')
  const [shifts, setShifts] = useState(initialShifts)
  const [weekOffset, setWeekOffset] = useState(0)
  const [showAddEmployee, setShowAddEmployee] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [aiMessage, setAiMessage] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [chatHistory, setChatHistory] = useState([])
  const [popup, setPopup] = useState(null)
  const [pendingList, setPendingList] = useState(pending || [])

  const today = new Date()
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7)
  const weekDates = Array.from({length: 7}, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().split('T')[0]
  })
  const weekLabel = `${monday.getDate()} ${monday.toLocaleString('fr-FR', {month:'long'})} – ${new Date(weekDates[6]).getDate()} ${new Date(weekDates[6]).toLocaleString('fr-FR', {month:'long', year:'numeric'})}`
  const empEmployees = employees.filter(e => e.role === 'employee')

  function getShift(employeeId, date) { return shifts.find(s => s.employee_id === employeeId && s.date === date) }
  function getEmpShifts(employeeId) { return shifts.filter(s => s.employee_id === employeeId && weekDates.includes(s.date)) }
  function getDayShifts(date) { return shifts.filter(s => s.date === date) }

  async function applyShift(option) {
    const { emp, date } = popup
    setPopup(null)
    if (option.type === 'repos') {
      await fetch('/api/delete-shift', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employee_id: emp.id, date }) })
      setShifts(s => s.filter(x => !(x.employee_id === emp.id && x.date === date)))
      return
    }
    const res = await fetch('/api/save-shift', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employee_id: emp.id, date, shift_type: option.type, start_time: option.start, end_time: option.end }) })
    const data = await res.json()
    if (data.shift) setShifts(s => [...s.filter(x => !(x.employee_id === emp.id && x.date === date)), data.shift])
  }

  async function approveEmployee(empId) {
    await fetch('/api/approve-employee', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employee_id: empId }) })
    setPendingList(p => p.filter(e => e.id !== empId))
    window.location.reload()
  }

  async function deleteEmployee(empId) {
    if (!confirm('Supprimer cet employé ?')) return
    await fetch('/api/delete-employee', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employee_id: empId }) })
    window.location.reload()
  }

  async function addEmployee() {
    setLoading(true); setMsg('')
    const res = await fetch('/api/add-employee', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: newEmail, password: newPassword, full_name: newName }) })
    const data = await res.json()
    if (data.error) setMsg('Erreur: ' + data.error)
    else { setMsg('✓ Employé ajouté !'); setNewName(''); setNewEmail(''); setNewPassword(''); setTimeout(() => window.location.reload(), 1000) }
    setLoading(false)
  }

  async function sendToAI() {
    if (!aiMessage.trim()) return
    setAiLoading(true)
    const userMsg = aiMessage; setAiMessage('')
    setChatHistory(h => [...h, { role: 'user', text: userMsg }])
    const res = await fetch('/api/ai-schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: userMsg, employees: empEmployees }) })
    const data = await res.json()
    if (data.error) setChatHistory(h => [...h, { role: 'ai', text: 'Erreur: ' + data.error }])
    else { setChatHistory(h => [...h, { role: 'ai', text: `✅ ${data.message} (${data.count} shifts créés)` }]); setTimeout(() => window.location.reload(), 1500) }
    setAiLoading(false)
  }

  const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
  const TABS = [
    { key: 'planning', icon: '📅', label: 'Planning' },
    { key: 'ia', icon: '✨', label: 'Assistant IA' },
    { key: 'employes', icon: '👥', label: 'Équipe' },
    { key: 'settings', icon: '⚙️', label: 'Paramètres' },
  ]

  const statCards = [
    { label: 'Employés', value: empEmployees.length, icon: '👥', color: '#3B82F6', bg: '#EFF6FF' },
    { label: 'Shifts cette semaine', value: weekDates.reduce((acc, d) => acc + getDayShifts(d).length, 0), icon: '📋', color: '#10B981', bg: '#ECFDF5' },
    { label: 'En attente', value: pendingList.length, icon: '⏳', color: '#F59E0B', bg: '#FEFCE8' },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #F0F4F8; font-family: 'Inter', -apple-system, sans-serif; color: #111827; }
        input, textarea, select { color: #111827 !important; font-family: 'Inter', -apple-system, sans-serif; }
        input::placeholder, textarea::placeholder { color: #9CA3AF !important; }

        .sb-wrap { max-width: 1440px; margin: 0 auto; padding: 20px 24px; }

        .sb-nav { background: white; border-radius: 20px; padding: 14px 24px; display: flex; align-items: center; gap: 16px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04); }
        .sb-logo { width: 40px; height: 40px; background: linear-gradient(135deg, #1D9E75, #0F6E56); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px; flex-shrink: 0; box-shadow: 0 4px 12px rgba(29,158,117,0.3); }
        .sb-appname { font-size: 18px; font-weight: 700; color: #111827; letter-spacing: -0.3px; }
        .sb-badge { font-size: 11px; font-weight: 600; color: #1D9E75; background: #ECFDF5; padding: 2px 8px; border-radius: 20px; border: 1px solid #A7F3D0; }
        .sb-nav-right { margin-left: auto; display: flex; align-items: center; gap: 12px; }
        .sb-user { display: flex; align-items: center; gap: 8px; }
        .sb-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #1D9E75, #0F6E56); display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: 700; }
        .sb-username { font-size: 13px; font-weight: 500; color: #374151; }
        .sb-logout { padding: 7px 16px; background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 10px; font-size: 13px; color: #6B7280; cursor: pointer; font-weight: 500; transition: all 0.15s; }
        .sb-logout:hover { background: #F3F4F6; color: #374151; }

        .sb-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .sb-stat { background: white; border-radius: 16px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04); display: flex; align-items: center; gap: 14px; }
        .sb-stat-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
        .sb-stat-val { font-size: 26px; font-weight: 700; letter-spacing: -0.5px; }
        .sb-stat-lbl { font-size: 12px; color: #6B7280; font-weight: 500; margin-top: 1px; }

        .sb-pending { background: linear-gradient(135deg, #FFFBEB, #FEF3C7); border: 1px solid #FDE68A; border-radius: 16px; padding: 16px 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .sb-pending-title { font-size: 13px; font-weight: 700; color: #92400E; margin-bottom: 12px; display: flex; align-items: center; gap: 6px; }
        .sb-pending-item { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap; background: white; border-radius: 10px; padding: 10px 14px; }
        .sb-pending-name { font-size: 13px; font-weight: 600; flex: 1; min-width: 120px; }
        .sb-pending-email { font-size: 12px; color: #9CA3AF; }
        .sb-approve { padding: 6px 14px; background: #1D9E75; color: white; border: none; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
        .sb-approve:hover { background: #0F6E56; transform: translateY(-1px); }
        .sb-refuse { padding: 6px 14px; background: white; color: #EF4444; border: 1px solid #FECACA; border-radius: 8px; font-size: 12px; cursor: pointer; transition: all 0.15s; }
        .sb-refuse:hover { background: #FEF2F2; }

        .sb-tabs { display: flex; gap: 4px; background: white; border-radius: 16px; padding: 6px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04); overflow-x: auto; width: fit-content; }
        .sb-tab { padding: 8px 20px; border-radius: 12px; border: none; font-size: 13px; cursor: pointer; background: transparent; color: #6B7280; font-weight: 500; white-space: nowrap; transition: all 0.2s; display: flex; align-items: center; gap: 6px; }
        .sb-tab:hover { background: #F9FAFB; color: #374151; }
        .sb-tab.active { background: linear-gradient(135deg, #1D9E75, #0F6E56); color: white; box-shadow: 0 4px 12px rgba(29,158,117,0.3); }

        .sb-card { background: white; border-radius: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04); overflow: hidden; }
        .sb-card-header { padding: 16px 24px; border-bottom: 1px solid #F3F4F6; display: flex; align-items: center; gap: 12px; }
        .sb-card-title { font-size: 15px; font-weight: 700; color: #111827; }
        .sb-card-sub { font-size: 12px; color: #9CA3AF; margin-left: auto; }

        .sb-week-nav { display: flex; align-items: center; gap: 10px; }
        .sb-nav-btn { width: 32px; height: 32px; border-radius: 10px; border: 1px solid #E5E7EB; background: white; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: all 0.15s; color: #374151; }
        .sb-nav-btn:hover { background: #F9FAFB; border-color: #D1D5DB; transform: translateY(-1px); }
        .sb-today-btn { font-size: 12px; color: #1D9E75; background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 8px; padding: 5px 12px; cursor: pointer; font-weight: 600; transition: all 0.15s; }
        .sb-today-btn:hover { background: #D1FAE5; }
        .sb-week-lbl { font-size: 14px; font-weight: 600; color: #374151; letter-spacing: -0.2px; }

        .sb-grid-outer { overflow-x: auto; }
        .sb-grid { display: grid; grid-template-columns: 170px repeat(7, 1fr); min-width: 720px; }
        .sb-gh { padding: 12px 8px; text-align: center; background: #FAFAFA; border-bottom: 1px solid #F3F4F6; }
        .sb-gh:first-child { text-align: left; padding-left: 20px; border-right: 1px solid #F3F4F6; }
        .sb-gh-day { font-size: 11px; font-weight: 700; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.5px; }
        .sb-gh-date { font-size: 22px; font-weight: 700; color: #374151; line-height: 1.1; margin: 3px 0; }
        .sb-gh-info { font-size: 11px; color: #9CA3AF; font-weight: 500; }
        .sb-gh.is-today .sb-gh-day { color: #1D9E75; }
        .sb-gh.is-today .sb-gh-date { color: white; background: linear-gradient(135deg, #1D9E75, #0F6E56); border-radius: 50%; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; margin: 3px auto; font-size: 16px; box-shadow: 0 4px 12px rgba(29,158,117,0.3); }

        .sb-emp-row { display: contents; }
        .sb-emp-cell { padding: 12px 16px; display: flex; align-items: center; gap: 10px; border-right: 1px solid #F3F4F6; border-bottom: 1px solid #F9FAFB; background: white; transition: background 0.1s; }
        .sb-emp-cell:hover { background: #FAFAFA; }
        .sb-emp-av { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; flex-shrink: 0; }
        .sb-emp-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sb-emp-hours { font-size: 11px; color: #9CA3AF; font-weight: 500; }

        .sb-shift-cell { padding: 5px; border-bottom: 1px solid #F9FAFB; border-left: 1px solid #F9FAFB; cursor: pointer; min-height: 62px; display: flex; align-items: center; justify-content: center; transition: background 0.15s; }
        .sb-shift-cell:hover { background: #F9FAFB; }
        .sb-shift-block { border-radius: 10px; padding: 6px 8px; width: 100%; border: 1.5px solid transparent; transition: transform 0.15s, box-shadow 0.15s; }
        .sb-shift-block:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        .sb-shift-time { font-size: 11px; font-weight: 700; }
        .sb-shift-dur { font-size: 10px; opacity: 0.7; margin-top: 2px; font-weight: 500; }
        .sb-cell-plus { color: #D1D5DB; font-size: 22px; font-weight: 300; transition: color 0.15s; }
        .sb-shift-cell:hover .sb-cell-plus { color: #1D9E75; }

        .sb-emp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
        .sb-emp-card { background: white; border-radius: 16px; padding: 16px; display: flex; align-items: center; gap: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04); transition: transform 0.15s, box-shadow 0.15s; }
        .sb-emp-card:hover { transform: translateY(-2px); box-shadow: 0 4px 6px rgba(0,0,0,0.07), 0 10px 30px rgba(0,0,0,0.06); }
        .sb-emp-card-av { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 800; flex-shrink: 0; }
        .sb-del-btn { width: 32px; height: 32px; border-radius: 10px; border: 1px solid #FECACA; background: #FEF2F2; color: #EF4444; cursor: pointer; font-size: 14px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
        .sb-del-btn:hover { background: #FEE2E2; transform: scale(1.05); }

        .sb-add-form { background: white; border-radius: 16px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04); }
        .sb-add-grid { display: grid; grid-template-columns: 1fr; gap: 12px; margin-bottom: 16px; }
        @media (min-width: 640px) { .sb-add-grid { grid-template-columns: 1fr 1fr 1fr; } }
        .sb-field label { display: block; font-size: 12px; color: #6B7280; margin-bottom: 5px; font-weight: 600; letter-spacing: 0.3px; }
        .sb-field input { width: 100%; padding: 9px 12px; border-radius: 10px; border: 1.5px solid #E5E7EB; font-size: 13px; color: #111827; transition: border-color 0.15s, box-shadow 0.15s; background: #FAFAFA; }
        .sb-field input:focus { outline: none; border-color: #1D9E75; box-shadow: 0 0 0 3px rgba(29,158,117,0.1); background: white; }
        .sb-add-btn { padding: 9px 20px; background: linear-gradient(135deg, #1D9E75, #0F6E56); color: white; border: none; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(29,158,117,0.25); }
        .sb-add-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(29,158,117,0.35); }
        .sb-add-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .sb-outline-btn { padding: 9px 20px; background: white; color: #374151; border: 1.5px solid #E5E7EB; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
        .sb-outline-btn:hover { background: #F9FAFB; border-color: #D1D5DB; }

        .sb-ai-wrap { display: grid; grid-template-columns: 1fr; gap: 16px; }
        @media (min-width: 768px) { .sb-ai-wrap { grid-template-columns: 1fr 260px; } }
        .sb-ai-msgs { min-height: 200px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 10px; padding: 4px 0; }
        .sb-bubble { max-width: 82%; padding: 10px 14px; border-radius: 14px; font-size: 13px; line-height: 1.5; }
        .sb-bubble-u { background: linear-gradient(135deg, #1D9E75, #0F6E56); color: white; align-self: flex-end; border-bottom-right-radius: 4px; box-shadow: 0 4px 12px rgba(29,158,117,0.25); }
        .sb-bubble-a { background: #F3F4F6; color: #374151; align-self: flex-start; border-bottom-left-radius: 4px; }
        .sb-ai-row { display: flex; gap: 8px; }
        .sb-ai-input { flex: 1; padding: 10px 14px; border-radius: 12px; border: 1.5px solid #E5E7EB; font-size: 13px; outline: none; color: #111827; transition: border-color 0.15s, box-shadow 0.15s; background: #FAFAFA; }
        .sb-ai-input:focus { border-color: #1D9E75; box-shadow: 0 0 0 3px rgba(29,158,117,0.1); background: white; }
        .sb-ai-send { padding: 10px 20px; background: linear-gradient(135deg, #1D9E75, #0F6E56); color: white; border: none; border-radius: 12px; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: all 0.2s; box-shadow: 0 4px 12px rgba(29,158,117,0.25); }
        .sb-ai-send:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(29,158,117,0.35); }
        .sb-ai-send:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .sb-ex-item { padding: 10px 12px; border-radius: 10px; border: 1.5px solid #F3F4F6; font-size: 12px; color: #6B7280; cursor: pointer; margin-bottom: 8px; transition: all 0.15s; font-weight: 500; }
        .sb-ex-item:hover { background: #F9FAFB; border-color: #1D9E75; color: #1D9E75; transform: translateX(2px); }

        .sb-empty { padding: 48px 20px; text-align: center; color: #9CA3AF; font-size: 14px; }
        .sb-empty-icon { font-size: 36px; margin-bottom: 10px; }
        .sb-empty-text { font-weight: 500; }

        @media (max-width: 640px) {
          .sb-wrap { padding: 12px 14px; }
          .sb-nav { padding: 12px 16px; }
          .sb-appname { font-size: 16px; }
          .sb-username { display: none; }
          .sb-stats { grid-template-columns: 1fr 1fr; }
          .sb-tabs { width: 100%; }
          .sb-tab { padding: 8px 12px; font-size: 12px; }
        }
      `}</style>

      <div className="sb-wrap">
        {popup && <ShiftPopup popup={popup} onClose={() => setPopup(null)} onApply={applyShift} />}

        <nav className="sb-nav">
          <div className="sb-logo">⚡</div>
          <span className="sb-appname">ShiftBoard</span>
          <span className="sb-badge">Admin</span>
          <div className="sb-nav-right">
            <div className="sb-user">
              <div className="sb-avatar">{profile?.full_name?.split(' ').map(n=>n[0]).join('').slice(0,2)}</div>
              <span className="sb-username">{profile?.full_name}</span>
            </div>
            <form action="/api/logout" method="POST" style={{display:'inline'}}>
              <button type="submit" className="sb-logout">Déconnexion</button>
            </form>
          </div>
        </nav>

        <div className="sb-stats">
          {statCards.map((s,i) => (
            <div key={i} className="sb-stat">
              <div className="sb-stat-icon" style={{background: s.bg}}>{s.icon}</div>
              <div>
                <div className="sb-stat-val" style={{color: s.color}}>{s.value}</div>
                <div className="sb-stat-lbl">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {pendingList.length > 0 && (
          <div className="sb-pending">
            <div className="sb-pending-title">⏳ {pendingList.length} compte{pendingList.length > 1 ? 's' : ''} en attente de validation</div>
            {pendingList.map(emp => (
              <div key={emp.id} className="sb-pending-item">
                <div style={{flex:1}}>
                  <div className="sb-pending-name">{emp.full_name}</div>
                  <div className="sb-pending-email">{emp.email}</div>
                </div>
                <button className="sb-approve" onClick={() => approveEmployee(emp.id)}>✓ Approuver</button>
                <button className="sb-refuse" onClick={() => deleteEmployee(emp.id)}>✕ Refuser</button>
              </div>
            ))}
          </div>
        )}

        <div className="sb-tabs">
          {TABS.map(t => (
            <button key={t.key} className={`sb-tab${tab===t.key?' active':''}`} onClick={() => setTab(t.key)}>
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        {tab === 'planning' && (
          <div className="sb-card">
            <div className="sb-card-header">
              <div className="sb-week-nav">
                <button className="sb-nav-btn" onClick={() => setWeekOffset(w => w-1)}>‹</button>
                <span className="sb-week-lbl">{weekLabel}</span>
                <button className="sb-nav-btn" onClick={() => setWeekOffset(w => w+1)}>›</button>
                {weekOffset !== 0 && <button className="sb-today-btn" onClick={() => setWeekOffset(0)}>Aujourd'hui</button>}
              </div>
              <span className="sb-card-sub">{empEmployees.length} employé{empEmployees.length > 1 ? 's' : ''}</span>
            </div>
            <div className="sb-grid-outer">
              <div className="sb-grid">
                <div className="sb-gh" style={{borderRight:'1px solid #F3F4F6'}}>
                  <span style={{fontSize:'11px', fontWeight:'700', color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.5px'}}>Employé</span>
                </div>
                {weekDates.map((date, i) => {
                  const isToday = date === today.toISOString().split('T')[0]
                  const ds = getDayShifts(date)
                  return (
                    <div key={date} className={`sb-gh${isToday?' is-today':''}`}>
                      <div className="sb-gh-day">{DAYS[i]}</div>
                      <div className="sb-gh-date">{new Date(date+'T12:00:00').getDate()}</div>
                      {ds.length > 0 && <div className="sb-gh-info">{ds.length}p · {getTotalHours(ds)}</div>}
                    </div>
                  )
                })}
                {empEmployees.map((emp, ei) => {
                  const c = EMP_COLORS[ei % EMP_COLORS.length]
                  const empS = getEmpShifts(emp.id)
                  return (
                    <div key={emp.id} style={{display:'contents'}}>
                      <div className="sb-emp-cell">
                        <div className="sb-emp-av" style={{background:c.bg, color:c.text, border:`2px solid ${c.border}`}}>
                          {emp.full_name.split(' ').map(n=>n[0]).join('').slice(0,2)}
                        </div>
                        <div style={{flex:1, minWidth:0}}>
                          <div className="sb-emp-name">{emp.full_name}</div>
                          <div className="sb-emp-hours">{empS.length > 0 ? getTotalHours(empS) : '0h'} cette sem.</div>
                        </div>
                      </div>
                      {weekDates.map(date => {
                        const shift = getShift(emp.id, date)
                        return (
                          <div key={date} className="sb-shift-cell" onClick={() => setPopup({emp, date})}>
                            {shift ? (
                              <div className="sb-shift-block" style={{background:c.bg, borderColor:c.border}}>
                                <div className="sb-shift-time" style={{color:c.text}}>{shift.start_time.slice(0,5)} – {shift.end_time.slice(0,5)}</div>
                                <div className="sb-shift-dur" style={{color:c.text}}>{getDuration(shift.start_time, shift.end_time)}</div>
                              </div>
                            ) : <span className="sb-cell-plus">+</span>}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
              {empEmployees.length === 0 && (
                <div className="sb-empty">
                  <div className="sb-empty-icon">👥</div>
                  <div className="sb-empty-text">Aucun employé — ajoutez-en dans l'onglet Équipe</div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'ia' && (
          <div className="sb-ai-wrap">
            <div className="sb-card" style={{padding:'24px'}}>
              <div style={{marginBottom:'20px'}}>
                <h2 style={{fontSize:'16px', fontWeight:'700', marginBottom:'4px'}}>Assistant IA</h2>
                <p style={{fontSize:'13px', color:'#9CA3AF'}}>Génère les horaires en langage naturel. L'IA utilise vos paramètres d'établissement automatiquement.</p>
              </div>
              <div className="sb-ai-msgs">
                {chatHistory.length === 0 && (
                  <div style={{textAlign:'center', padding:'40px 0', color:'#D1D5DB'}}>
                    <div style={{fontSize:'32px', marginBottom:'8px'}}>✨</div>
                    <div style={{fontSize:'13px', fontWeight:'500'}}>Décris les horaires à créer...</div>
                  </div>
                )}
                {chatHistory.map((m,i) => <div key={i} className={`sb-bubble ${m.role==='user'?'sb-bubble-u':'sb-bubble-a'}`}>{m.text}</div>)}
                {aiLoading && <div className="sb-bubble sb-bubble-a" style={{display:'flex', alignItems:'center', gap:'8px'}}><span style={{animation:'spin 1s linear infinite', display:'inline-block'}}>⏳</span> Génération en cours...</div>}
              </div>
              <div className="sb-ai-row">
                <input className="sb-ai-input" value={aiMessage} onChange={e=>setAiMessage(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendToAI()} placeholder="Ex: Fais les horaires de la semaine prochaine pour toute l'équipe..." />
                <button className="sb-ai-send" onClick={sendToAI} disabled={aiLoading}>Envoyer</button>
              </div>
            </div>
            <div className="sb-card" style={{padding:'20px'}}>
              <h3 style={{fontSize:'13px', fontWeight:'700', marginBottom:'14px', color:'#374151'}}>Exemples de commandes</h3>
              {[
                'Fais les horaires de cette semaine',
                '2 employés par shift ce weekend',
                'Donne un repos à chaque employé',
                'Saison estivale : renforcé',
                'Semaine prochaine comme cette semaine',
              ].map((ex,i) => (
                <div key={i} className="sb-ex-item" onClick={()=>setAiMessage(ex)}>{ex}</div>
              ))}
            </div>
          </div>
        )}

        {tab === 'employes' && (
          <div>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'18px'}}>
              <div>
                <h2 style={{fontSize:'16px', fontWeight:'700', marginBottom:'2px'}}>Équipe</h2>
                <p style={{fontSize:'13px', color:'#9CA3AF'}}>{empEmployees.length} employé{empEmployees.length > 1 ? 's' : ''} actif{empEmployees.length > 1 ? 's' : ''}</p>
              </div>
              <button className="sb-add-btn" onClick={()=>setShowAddEmployee(!showAddEmployee)}>
                {showAddEmployee ? '✕ Fermer' : '+ Ajouter un employé'}
              </button>
            </div>
            {showAddEmployee && (
              <div className="sb-add-form" style={{marginBottom:'20px'}}>
                <h3 style={{fontSize:'14px', fontWeight:'700', marginBottom:'14px', color:'#374151'}}>Nouveau membre</h3>
                <div className="sb-add-grid">
                  {[['Nom complet', newName, setNewName, 'text', 'Jean Dupont'],['Email', newEmail, setNewEmail, 'email', 'jean@email.com'],['Mot de passe', newPassword, setNewPassword, 'password', '••••••••']].map(([label,val,setter,type,ph]) => (
                    <div key={label} className="sb-field">
                      <label>{label}</label>
                      <input type={type} value={val} onChange={e=>setter(e.target.value)} placeholder={ph} />
                    </div>
                  ))}
                </div>
                {msg && <p style={{fontSize:'13px', color:msg.includes('Erreur')?'#EF4444':'#1D9E75', marginBottom:'12px', fontWeight:'500'}}>{msg}</p>}
                <div style={{display:'flex', gap:'10px'}}>
                  <button onClick={addEmployee} disabled={loading} className="sb-add-btn">{loading?'Création...':'Créer le compte'}</button>
                  <button onClick={()=>setShowAddEmployee(false)} className="sb-outline-btn">Annuler</button>
                </div>
              </div>
            )}
            <div className="sb-emp-grid">
              {empEmployees.map((emp,ei) => {
                const c = EMP_COLORS[ei % EMP_COLORS.length]
                return (
                  <div key={emp.id} className="sb-emp-card">
                    <div className="sb-emp-card-av" style={{background:c.bg, color:c.text, border:`2px solid ${c.border}`}}>
                      {emp.full_name.split(' ').map(n=>n[0]).join('').slice(0,2)}
                    </div>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:'14px', fontWeight:'600', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{emp.full_name}</div>
                      <div style={{fontSize:'12px', color:'#9CA3AF', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{emp.email}</div>
                    </div>
                    <button className="sb-del-btn" onClick={()=>deleteEmployee(emp.id)} title="Supprimer">🗑</button>
                  </div>
                )
              })}
              {empEmployees.length === 0 && (
                <div className="sb-empty" style={{gridColumn:'1/-1', background:'white', borderRadius:'16px'}}>
                  <div className="sb-empty-icon">👥</div>
                  <div className="sb-empty-text">Aucun employé pour l'instant</div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'settings' && <SettingsTab />}
      </div>
    </>
  )
}
