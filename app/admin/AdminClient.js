'use client'
import { useState } from 'react'
import ShiftPopup from './ShiftPopup'
import SettingsTab from './SettingsTab'

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

function getMins(start, end) {
  const [sh, sm] = start.slice(0,5).split(':').map(Number)
  const [eh, em] = end.slice(0,5).split(':').map(Number)
  let mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins < 0) mins += 24 * 60
  return mins
}

function formatHours(mins) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h${m.toString().padStart(2,'0')}` : `${h}h`
}

function getTotalMins(shifts) {
  return shifts.reduce((acc, s) => acc + getMins(s.start_time, s.end_time), 0)
}

export default function AdminClient({ profile, employees, allEmployees, shifts: initialShifts, pending, businesses, activeBizId, allBizEmployees }) {
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
  const [showAddBusiness, setShowAddBusiness] = useState(false)
  const [newBizName, setNewBizName] = useState('')
  const [bizEmployees, setBizEmployees] = useState(allBizEmployees || [])

  const today = new Date()
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7)
  const weekDates = Array.from({length: 7}, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().split('T')[0]
  })
  const weekLabel = `${monday.getDate()} ${monday.toLocaleString('fr-FR', {month:'long'})} – ${new Date(weekDates[6]).getDate()} ${new Date(weekDates[6]).toLocaleString('fr-FR', {month:'long', year:'numeric'})}`
  const empEmployees = employees

  function getCellShifts(employeeId, date) {
    return shifts.filter(s => s.employee_id === employeeId && s.date === date)
  }

  function getEmpWeekShifts(employeeId) {
    return shifts.filter(s => s.employee_id === employeeId && weekDates.includes(s.date))
  }

  function getDayShifts(date) {
    return shifts.filter(s => s.date === date && empEmployees.find(e => e.id === s.employee_id))
  }

  function isEmpInBiz(empId, bizId) {
    return bizEmployees.some(be => be.employee_id === empId && be.business_id === bizId)
  }

  async function toggleEmpBiz(empId, bizId) {
    const action = isEmpInBiz(empId, bizId) ? 'remove' : 'add'
    await fetch('/api/assign-employee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee_id: empId, business_id: bizId, action })
    })
    if (action === 'add') {
      setBizEmployees(prev => [...prev, { employee_id: empId, business_id: bizId }])
    } else {
      setBizEmployees(prev => prev.filter(be => !(be.employee_id === empId && be.business_id === bizId)))
    }
  }

  async function applyShift(option) {
    const { emp, date } = popup
    const res = await fetch('/api/save-shift', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee_id: emp.id, date, shift_type: option.type, start_time: option.start, end_time: option.end })
    })
    const data = await res.json()
    if (data.shift) {
      setShifts(s => [...s, data.shift])
      setPopup(prev => prev ? { ...prev, existingShifts: [...(prev.existingShifts || []), data.shift] } : null)
    }
  }

  async function deleteShiftById(shiftId) {
    await fetch('/api/delete-shift-by-id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shift_id: shiftId })
    })
    setShifts(s => s.filter(x => x.id !== shiftId))
    setPopup(prev => prev ? { ...prev, existingShifts: (prev.existingShifts || []).filter(s => s.id !== shiftId) } : null)
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

  async function addBusiness() {
    if (!newBizName.trim()) return
    setLoading(true)
    await fetch('/api/businesses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newBizName }) })
    setNewBizName('')
    setShowAddBusiness(false)
    setLoading(false)
    window.location.reload()
  }

  async function sendToAI() {
    if (!aiMessage.trim()) return
    setAiLoading(true)
    const userMsg = aiMessage; setAiMessage('')
    setChatHistory(h => [...h, { role: 'user', text: userMsg }])
    const res = await fetch('/api/ai-schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: userMsg, employees: empEmployees, business_id: activeBizId }) })
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

  const totalWeekMins = weekDates.reduce((acc, d) => acc + getTotalMins(getDayShifts(d)), 0)
  const totalWeekShifts = weekDates.reduce((acc, d) => acc + getDayShifts(d).length, 0)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #F0F4F8; font-family: 'Inter', -apple-system, sans-serif; color: #111827; }
        input, textarea, select { color: #111827 !important; font-family: 'Inter', sans-serif; }
        input::placeholder, textarea::placeholder { color: #9CA3AF !important; }

        .sb-wrap { max-width: 1440px; margin: 0 auto; padding: 20px 24px; }
        .sb-nav { background: white; border-radius: 20px; padding: 14px 24px; display: flex; align-items: center; gap: 16px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04); }
        .sb-logo { width: 40px; height: 40px; background: linear-gradient(135deg, #1D9E75, #0F6E56); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px; flex-shrink: 0; box-shadow: 0 4px 12px rgba(29,158,117,0.3); }
        .sb-appname { font-size: 18px; font-weight: 700; color: #111827; }
        .sb-badge { font-size: 11px; font-weight: 600; color: #1D9E75; background: #ECFDF5; padding: 2px 8px; border-radius: 20px; border: 1px solid #A7F3D0; }
        .sb-nav-right { margin-left: auto; display: flex; align-items: center; gap: 12px; }
        .sb-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #1D9E75, #0F6E56); display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: 700; }
        .sb-username { font-size: 13px; font-weight: 500; color: #374151; }
        .sb-logout { padding: 7px 16px; background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 10px; font-size: 13px; color: #6B7280; cursor: pointer; font-weight: 500; }

        .sb-pending { background: linear-gradient(135deg, #FFFBEB, #FEF3C7); border: 1px solid #FDE68A; border-radius: 16px; padding: 16px 20px; margin-bottom: 20px; }
        .sb-pending-item { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; background: white; border-radius: 10px; padding: 10px 14px; flex-wrap: wrap; }
        .sb-approve { padding: 6px 14px; background: #1D9E75; color: white; border: none; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; }
        .sb-refuse { padding: 6px 14px; background: white; color: #EF4444; border: 1px solid #FECACA; border-radius: 8px; font-size: 12px; cursor: pointer; }

        .sb-tabs { display: flex; gap: 4px; background: white; border-radius: 16px; padding: 6px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04); overflow-x: auto; width: fit-content; max-width: 100%; }
        .sb-tab { padding: 8px 18px; border-radius: 12px; border: none; font-size: 13px; cursor: pointer; background: transparent; color: #6B7280; font-weight: 500; white-space: nowrap; transition: all 0.2s; display: flex; align-items: center; gap: 6px; }
        .sb-tab.active { background: linear-gradient(135deg, #1D9E75, #0F6E56); color: white; box-shadow: 0 4px 12px rgba(29,158,117,0.3); }

        .sb-planning-card { background: white; border-radius: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04); overflow: hidden; }
        .sb-toolbar { padding: 14px 20px; border-bottom: 1px solid #F3F4F6; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .sb-nav-btn { width: 32px; height: 32px; border-radius: 10px; border: 1px solid #E5E7EB; background: white; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
        .sb-nav-btn:hover { background: #F9FAFB; transform: translateY(-1px); }
        .sb-week-lbl { font-size: 14px; font-weight: 600; color: #374151; }
        .sb-today-btn { font-size: 12px; color: #1D9E75; background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 8px; padding: 5px 12px; cursor: pointer; font-weight: 600; }
        .sb-week-summary { margin-left: auto; display: flex; align-items: center; gap: 16px; }
        .sb-week-stat-val { font-size: 16px; font-weight: 700; color: #1D9E75; }
        .sb-week-stat-lbl { font-size: 10px; color: #9CA3AF; font-weight: 500; text-transform: uppercase; letter-spacing: 0.3px; }

        .sb-grid-outer { overflow-x: auto; }
        .sb-grid { display: grid; grid-template-columns: 170px repeat(7, 1fr) 80px; min-width: 780px; }
        .sb-gh { padding: 10px 6px; text-align: center; background: #FAFAFA; border-bottom: 1px solid #F3F4F6; }
        .sb-gh:first-child { text-align: left; padding-left: 18px; border-right: 1px solid #F3F4F6; }
        .sb-gh:last-child { background: #F8FAFC; border-left: 1px solid #F3F4F6; }
        .sb-gh-day { font-size: 10px; font-weight: 700; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.5px; }
        .sb-gh-date { font-size: 20px; font-weight: 700; color: #374151; line-height: 1.1; margin: 3px 0; }
        .sb-gh.is-today .sb-gh-day { color: #1D9E75; }
        .sb-gh.is-today .sb-gh-date { color: white; background: linear-gradient(135deg, #1D9E75, #0F6E56); border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; margin: 3px auto; font-size: 15px; box-shadow: 0 4px 12px rgba(29,158,117,0.3); }

        .sb-emp-cell { padding: 10px 14px; display: flex; align-items: center; gap: 8px; border-right: 1px solid #F3F4F6; border-bottom: 1px solid #F9FAFB; background: white; }
        .sb-emp-av { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; flex-shrink: 0; }
        .sb-emp-name { font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sb-emp-h { font-size: 10px; color: #9CA3AF; font-weight: 500; }

        .sb-shift-cell { padding: 4px; border-bottom: 1px solid #F9FAFB; border-left: 1px solid #F9FAFB; cursor: pointer; min-height: 60px; display: flex; flex-direction: column; align-items: stretch; justify-content: center; gap: 3px; transition: background 0.15s; }
        .sb-shift-cell:hover { background: #F9FAFB; }
        .sb-shift-block { border-radius: 8px; padding: 4px 6px; border: 1.5px solid transparent; transition: transform 0.15s; }
        .sb-shift-block:hover { transform: translateY(-1px); }
        .sb-shift-time { font-size: 10px; font-weight: 700; }
        .sb-shift-dur { font-size: 9px; opacity: 0.7; }
        .sb-cell-plus { color: #D1D5DB; font-size: 20px; text-align: center; transition: color 0.15s; }
        .sb-shift-cell:hover .sb-cell-plus { color: #1D9E75; }
        .sb-cell-add { font-size: 10px; color: #1D9E75; text-align: center; font-weight: 600; opacity: 0; transition: opacity 0.15s; }
        .sb-shift-cell:hover .sb-cell-add { opacity: 1; }

        .sb-total-cell { padding: 4px 8px; border-bottom: 1px solid #F9FAFB; border-left: 1px solid #F3F4F6; display: flex; align-items: center; justify-content: center; min-height: 60px; background: #FAFAFA; }
        .sb-total-val { font-size: 12px; font-weight: 700; color: #374151; text-align: center; }
        .sb-total-shifts { font-size: 10px; color: #9CA3AF; text-align: center; }

        .sb-day-total-cell { padding: 8px 6px; background: #F8FAFC; border-top: 1.5px solid #E5E7EB; text-align: center; border-left: 1px solid #F3F4F6; }
        .sb-day-total-cell:first-child { text-align: left; padding-left: 18px; border-right: 1px solid #F3F4F6; border-left: none; font-size: 11px; font-weight: 700; color: #6B7280; text-transform: uppercase; letter-spacing: 0.3px; }
        .sb-day-h { font-size: 12px; font-weight: 700; color: #374151; }
        .sb-day-p { font-size: 10px; color: #9CA3AF; font-weight: 500; }

        .sb-card { background: white; border-radius: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04); padding: 24px; }
        .sb-emp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
        .sb-emp-card { background: white; border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04); transition: transform 0.15s; }
        .sb-emp-card:hover { transform: translateY(-2px); }
        .sb-emp-card-top { display: flex; align-items: center; gap: 12px; }
        .sb-emp-card-av { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 800; flex-shrink: 0; }
        .sb-del-btn { width: 32px; height: 32px; border-radius: 10px; border: 1px solid #FECACA; background: #FEF2F2; color: #EF4444; cursor: pointer; font-size: 14px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
        .sb-biz-tags { display: flex; flex-wrap: wrap; gap: 6px; }
        .sb-biz-tag { padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; cursor: pointer; border: 1.5px solid transparent; transition: all 0.15s; }
        .sb-biz-tag.active { background: linear-gradient(135deg, #1D9E75, #0F6E56); color: white; border-color: transparent; box-shadow: 0 2px 8px rgba(29,158,117,0.3); }
        .sb-biz-tag.inactive { background: #F9FAFB; color: #9CA3AF; border-color: #E5E7EB; }
        .sb-biz-tag.inactive:hover { border-color: #1D9E75; color: #1D9E75; }

        .sb-add-form { background: white; border-radius: 16px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04); }
        .sb-add-grid { display: grid; grid-template-columns: 1fr; gap: 12px; margin-bottom: 16px; }
        @media (min-width: 640px) { .sb-add-grid { grid-template-columns: 1fr 1fr 1fr; } }
        .sb-field label { display: block; font-size: 12px; color: #6B7280; margin-bottom: 5px; font-weight: 600; }
        .sb-field input { width: 100%; padding: 9px 12px; border-radius: 10px; border: 1.5px solid #E5E7EB; font-size: 13px; color: #111827; background: #FAFAFA; transition: all 0.15s; }
        .sb-field input:focus { outline: none; border-color: #1D9E75; box-shadow: 0 0 0 3px rgba(29,158,117,0.1); background: white; }
        .sb-add-btn { padding: 9px 20px; background: linear-gradient(135deg, #1D9E75, #0F6E56); color: white; border: none; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(29,158,117,0.25); transition: all 0.2s; }
        .sb-add-btn:hover { transform: translateY(-1px); }
        .sb-outline-btn { padding: 9px 20px; background: white; color: #374151; border: 1.5px solid #E5E7EB; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; }

        .sb-ai-wrap { display: grid; grid-template-columns: 1fr; gap: 16px; }
        @media (min-width: 768px) { .sb-ai-wrap { grid-template-columns: 1fr 260px; } }
        .sb-ai-msgs { min-height: 200px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 10px; }
        .sb-bubble { max-width: 82%; padding: 10px 14px; border-radius: 14px; font-size: 13px; line-height: 1.5; }
        .sb-bubble-u { background: linear-gradient(135deg, #1D9E75, #0F6E56); color: white; align-self: flex-end; }
        .sb-bubble-a { background: #F3F4F6; color: #374151; align-self: flex-start; }
        .sb-ai-row { display: flex; gap: 8px; }
        .sb-ai-input { flex: 1; padding: 10px 14px; border-radius: 12px; border: 1.5px solid #E5E7EB; font-size: 13px; outline: none; color: #111827; background: #FAFAFA; transition: all 0.15s; }
        .sb-ai-input:focus { border-color: #1D9E75; box-shadow: 0 0 0 3px rgba(29,158,117,0.1); background: white; }
        .sb-ai-send { padding: 10px 20px; background: linear-gradient(135deg, #1D9E75, #0F6E56); color: white; border: none; border-radius: 12px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .sb-ai-send:hover { transform: translateY(-1px); }
        .sb-ex-item { padding: 10px 12px; border-radius: 10px; border: 1.5px solid #F3F4F6; font-size: 12px; color: #6B7280; cursor: pointer; margin-bottom: 8px; transition: all 0.15s; font-weight: 500; }
        .sb-ex-item:hover { border-color: #1D9E75; color: #1D9E75; transform: translateX(2px); }
        .sb-empty { padding: 48px 20px; text-align: center; color: #9CA3AF; font-size: 14px; }

        @media (max-width: 640px) {
          .sb-wrap { padding: 12px 14px; }
          .sb-username { display: none; }
          .sb-tabs { width: 100%; }
          .sb-week-summary { display: none; }
        }
      `}</style>

      <div className="sb-wrap">
        {popup && (
          <ShiftPopup
            popup={popup}
            onClose={() => setPopup(null)}
            onApply={applyShift}
            onDelete={deleteShiftById}
          />
        )}

        <nav className="sb-nav">
          <div className="sb-logo">⚡</div>
          <span className="sb-appname">ShiftBoard</span>
          <span className="sb-badge">Admin</span>
          <div className="sb-nav-right">
            <div className="sb-avatar">{profile?.full_name?.split(' ').map(n=>n[0]).join('').slice(0,2)}</div>
            <span className="sb-username">{profile?.full_name}</span>
            <form action="/api/logout" method="POST" style={{display:'inline'}}>
              <button type="submit" className="sb-logout">Déconnexion</button>
            </form>
          </div>
        </nav>

        <div style={{display:"flex", alignItems:"center", gap:"8px", marginBottom:"20px", flexWrap:"wrap"}}>
          {businesses.map(biz => (
            <button
              key={biz.id}
              onClick={() => { window.location.href = `/admin?biz=${biz.id}` }}
              style={{padding:"8px 18px", borderRadius:"12px", border: biz.id === activeBizId ? "none" : "1.5px solid #E5E7EB", background: biz.id === activeBizId ? "linear-gradient(135deg, #1D9E75, #0F6E56)" : "white", color: biz.id === activeBizId ? "white" : "#6B7280", fontSize:"13px", fontWeight:"600", cursor:"pointer", boxShadow: biz.id === activeBizId ? "0 4px 12px rgba(29,158,117,0.3)" : "0 1px 3px rgba(0,0,0,0.04)"}}
            >
              🏠 {biz.name}
            </button>
          ))}
          {!showAddBusiness ? (
            <button onClick={() => setShowAddBusiness(true)} style={{padding:"8px 14px", borderRadius:"12px", border:"1.5px dashed #D1D5DB", background:"transparent", fontSize:"13px", fontWeight:"600", cursor:"pointer", color:"#9CA3AF"}}>+ Nouvel établissement</button>
          ) : (
            <div style={{display:"flex", gap:"8px", alignItems:"center"}}>
              <input value={newBizName} onChange={e => setNewBizName(e.target.value)} onKeyDown={e => e.key === "Enter" && addBusiness()} placeholder="Nom de l'établissement" autoFocus style={{padding:"8px 14px", borderRadius:"10px", border:"1.5px solid #E5E7EB", fontSize:"13px", color:"#111827", outline:"none", width:"180px"}} />
              <button onClick={addBusiness} disabled={loading} style={{padding:"8px 14px", background:"linear-gradient(135deg, #1D9E75, #0F6E56)", color:"white", border:"none", borderRadius:"10px", fontSize:"13px", fontWeight:"600", cursor:"pointer"}}>{loading ? "..." : "Créer"}</button>
              <button onClick={() => setShowAddBusiness(false)} style={{padding:"8px 14px", background:"white", color:"#374151", border:"1.5px solid #E5E7EB", borderRadius:"10px", fontSize:"13px", fontWeight:"600", cursor:"pointer"}}>✕</button>
            </div>
          )}
        </div>

        {pendingList.length > 0 && (
          <div className="sb-pending">
            <div style={{fontSize:'13px', fontWeight:'700', color:'#92400E', marginBottom:'10px'}}>⏳ {pendingList.length} compte{pendingList.length > 1 ? 's' : ''} en attente</div>
            {pendingList.map(emp => (
              <div key={emp.id} className="sb-pending-item">
                <div style={{flex:1}}>
                  <div style={{fontSize:'13px', fontWeight:'600'}}>{emp.full_name}</div>
                  <div style={{fontSize:'12px', color:'#9CA3AF'}}>{emp.email}</div>
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
          <div className="sb-planning-card">
            <div className="sb-toolbar">
              <button className="sb-nav-btn" onClick={() => setWeekOffset(w => w-1)}>‹</button>
              <span className="sb-week-lbl">{weekLabel}</span>
              <button className="sb-nav-btn" onClick={() => setWeekOffset(w => w+1)}>›</button>
              {weekOffset !== 0 && <button className="sb-today-btn" onClick={() => setWeekOffset(0)}>Aujourd'hui</button>}
              <div className="sb-week-summary">
                <div>
                  <div className="sb-week-stat-val">{formatHours(totalWeekMins)}</div>
                  <div className="sb-week-stat-lbl">Heures semaine</div>
                </div>
                <div style={{width:'1px', height:'30px', background:'#E5E7EB'}}></div>
                <div>
                  <div className="sb-week-stat-val">{totalWeekShifts}</div>
                  <div className="sb-week-stat-lbl">Shifts total</div>
                </div>
              </div>
            </div>
            <div className="sb-grid-outer">
              <div className="sb-grid">
                <div className="sb-gh" style={{borderRight:'1px solid #F3F4F6'}}>
                  <span style={{fontSize:'10px', fontWeight:'700', color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.5px'}}>Employé</span>
                </div>
                {weekDates.map((date, i) => {
                  const isToday = date === today.toISOString().split('T')[0]
                  return (
                    <div key={date} className={`sb-gh${isToday?' is-today':''}`}>
                      <div className="sb-gh-day">{DAYS[i]}</div>
                      <div className="sb-gh-date">{new Date(date+'T12:00:00').getDate()}</div>
                    </div>
                  )
                })}
                <div className="sb-gh" style={{borderLeft:'1px solid #F3F4F6'}}>
                  <span style={{fontSize:'10px', fontWeight:'700', color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.3px'}}>Total</span>
                </div>

                {empEmployees.map((emp, ei) => {
                  const c = EMP_COLORS[ei % EMP_COLORS.length]
                  const empS = getEmpWeekShifts(emp.id)
                  const empMins = getTotalMins(empS)
                  return (
                    <div key={emp.id} style={{display:'contents'}}>
                      <div className="sb-emp-cell">
                        <div className="sb-emp-av" style={{background:c.bg, color:c.text, border:`2px solid ${c.border}`}}>
                          {emp.full_name.split(' ').map(n=>n[0]).join('').slice(0,2)}
                        </div>
                        <div style={{flex:1, minWidth:0}}>
                          <div className="sb-emp-name">{emp.full_name}</div>
                          <div className="sb-emp-h">{empMins > 0 ? formatHours(empMins) : '0h'} · {empS.length} shift{empS.length > 1 ? 's' : ''}</div>
                        </div>
                      </div>
                      {weekDates.map(date => {
                        const cellShifts = getCellShifts(emp.id, date)
                        return (
                          <div key={date} className="sb-shift-cell" onClick={() => setPopup({emp, date, existingShifts: cellShifts})}>
                            {cellShifts.length > 0 ? (
                              <>
                                {cellShifts.map(shift => (
                                  <div key={shift.id} className="sb-shift-block" style={{background:c.bg, borderColor:c.border}}>
                                    <div className="sb-shift-time" style={{color:c.text}}>{shift.start_time.slice(0,5)}–{shift.end_time.slice(0,5)}</div>
                                    <div className="sb-shift-dur" style={{color:c.text}}>{formatHours(getMins(shift.start_time, shift.end_time))}</div>
                                  </div>
                                ))}
                                <div className="sb-cell-add">+ ajouter</div>
                              </>
                            ) : <span className="sb-cell-plus">+</span>}
                          </div>
                        )
                      })}
                      <div className="sb-total-cell">
                        <div>
                          <div className="sb-total-val" style={{color: empMins > 0 ? c.text : '#D1D5DB'}}>{empMins > 0 ? formatHours(empMins) : '—'}</div>
                          {empS.length > 0 && <div className="sb-total-shifts">{empS.length} shift{empS.length > 1 ? 's' : ''}</div>}
                        </div>
                      </div>
                    </div>
                  )
                })}

                {empEmployees.length > 0 && (
                  <div style={{display:'contents'}}>
                    <div className="sb-day-total-cell" style={{borderRight:'1px solid #F3F4F6'}}>Heures trav.</div>
                    {weekDates.map(date => {
                      const ds = getDayShifts(date)
                      const dayMins = getTotalMins(ds)
                      return (
                        <div key={date} className="sb-day-total-cell">
                          {dayMins > 0 ? (
                            <>
                              <div className="sb-day-h">{formatHours(dayMins)}</div>
                              <div className="sb-day-p">{ds.length} pers.</div>
                            </>
                          ) : <span style={{color:'#E5E7EB', fontSize:'12px'}}>—</span>}
                        </div>
                      )
                    })}
                    <div className="sb-day-total-cell" style={{borderLeft:'1px solid #F3F4F6'}}>
                      <div className="sb-day-h" style={{color:'#1D9E75'}}>{formatHours(totalWeekMins)}</div>
                      <div className="sb-day-p">total</div>
                    </div>
                  </div>
                )}

                {empEmployees.length === 0 && (
                  <div style={{gridColumn:'1/-1'}} className="sb-empty">Aucun employé — ajoutez-en dans l'onglet Équipe</div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'ia' && (
          <div className="sb-ai-wrap">
            <div className="sb-card">
              <h2 style={{fontSize:'16px', fontWeight:'700', marginBottom:'4px'}}>Assistant IA</h2>
              <p style={{fontSize:'13px', color:'#9CA3AF', marginBottom:'20px'}}>Génère les horaires en langage naturel.</p>
              <div className="sb-ai-msgs">
                {chatHistory.length === 0 && (
                  <div style={{textAlign:'center', padding:'40px 0', color:'#D1D5DB'}}>
                    <div style={{fontSize:'32px', marginBottom:'8px'}}>✨</div>
                    <div style={{fontSize:'13px', fontWeight:'500'}}>Décris les horaires à créer...</div>
                  </div>
                )}
                {chatHistory.map((m,i) => <div key={i} className={`sb-bubble ${m.role==='user'?'sb-bubble-u':'sb-bubble-a'}`}>{m.text}</div>)}
                {aiLoading && <div className="sb-bubble sb-bubble-a">⏳ Génération en cours...</div>}
              </div>
              <div className="sb-ai-row">
                <input className="sb-ai-input" value={aiMessage} onChange={e=>setAiMessage(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendToAI()} placeholder="Ex: Fais les horaires de la semaine prochaine..." />
                <button className="sb-ai-send" onClick={sendToAI} disabled={aiLoading}>Envoyer</button>
              </div>
            </div>
            <div className="sb-card">
              <h3 style={{fontSize:'13px', fontWeight:'700', marginBottom:'14px', color:'#374151'}}>Exemples</h3>
              {['Fais les horaires de cette semaine','2 employés par shift ce weekend','Repos à chaque employé ce weekend','Saison estivale : shifts renforcés','Semaine prochaine identique'].map((ex,i) => (
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
                <p style={{fontSize:'13px', color:'#9CA3AF'}}>{allEmployees.length} employé{allEmployees.length > 1 ? 's' : ''}</p>
              </div>
              <button className="sb-add-btn" onClick={()=>setShowAddEmployee(!showAddEmployee)}>
                {showAddEmployee ? '✕ Fermer' : '+ Ajouter un employé'}
              </button>
            </div>
            {showAddEmployee && (
              <div className="sb-add-form">
                <h3 style={{fontSize:'14px', fontWeight:'700', marginBottom:'14px'}}>Nouveau membre</h3>
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
            {businesses.length > 1 && (
              <div style={{background:'#F0FDF4', border:'1px solid #A7F3D0', borderRadius:'12px', padding:'10px 16px', marginBottom:'16px', fontSize:'12px', color:'#065F46', fontWeight:'500'}}>
                💡 Clique sur les badges d'établissement pour assigner ou retirer un employé
              </div>
            )}
            <div className="sb-emp-grid">
              {allEmployees.map((emp, ei) => {
                const c = EMP_COLORS[ei % EMP_COLORS.length]
                return (
                  <div key={emp.id} className="sb-emp-card">
                    <div className="sb-emp-card-top">
                      <div className="sb-emp-card-av" style={{background:c.bg, color:c.text, border:`2px solid ${c.border}`}}>
                        {emp.full_name.split(' ').map(n=>n[0]).join('').slice(0,2)}
                      </div>
                      <div style={{flex:1, minWidth:0}}>
                        <div style={{fontSize:'14px', fontWeight:'600', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{emp.full_name}</div>
                        <div style={{fontSize:'12px', color:'#9CA3AF', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{emp.email}</div>
                      </div>
                      <button className="sb-del-btn" onClick={()=>deleteEmployee(emp.id)}>🗑</button>
                    </div>
                    {businesses.length > 0 && (
                      <div className="sb-biz-tags">
                        {businesses.map(biz => (
                          <button
                            key={biz.id}
                            className={`sb-biz-tag ${isEmpInBiz(emp.id, biz.id) ? 'active' : 'inactive'}`}
                            onClick={() => toggleEmpBiz(emp.id, biz.id)}
                            title={isEmpInBiz(emp.id, biz.id) ? `Retirer de ${biz.name}` : `Ajouter à ${biz.name}`}
                          >
                            {isEmpInBiz(emp.id, biz.id) ? '✓' : '+'} {biz.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {tab === 'settings' && <SettingsTab activeBizId={activeBizId} />}
      </div>
    </>
  )
}
