import { createClient } from '../../../utils/supabase/server'

function parseOpeningHours(text) {
  const result = {}
  const lines = text.toLowerCase().split('\n').filter(l => l.trim())
  const dayMap = {
    'lundi - mercredi': [0,1,2], 'lundi – mercredi': [0,1,2],
    'lundi - vendredi': [0,1,2,3,4], 'lundi – vendredi': [0,1,2,3,4],
    'lundi': [0], 'mardi': [1], 'mercredi': [2], 'jeudi': [3],
    'vendredi': [4], 'samedi': [5], 'dimanche': [6]
  }
  for (const line of lines) {
    const timeMatch = line.match(/(\d{1,2})h(\d{0,2})\s*[-–]\s*(\d{1,2})h(\d{0,2})/)
    if (!timeMatch) continue
    const open = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2] || 0)
    const close = parseInt(timeMatch[3]) * 60 + parseInt(timeMatch[4] || 0)
    for (const [key, days] of Object.entries(dayMap)) {
      if (line.includes(key)) {
        for (const d of days) result[d] = { open, close: close <= open ? close + 24*60 : close }
      }
    }
  }
  return result
}

function minsToTime(m) {
  const h = Math.floor((m % (24*60)) / 60)
  const min = m % 60
  return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}:00`
}

function getWeekDatesFromDate(dateStr) {
  const date = new Date(dateStr + 'T12:00:00')
  const dayOfWeek = (date.getDay() + 6) % 7
  const monday = new Date(date)
  monday.setDate(date.getDate() - dayOfWeek)
  return Array.from({length: 7}, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().split('T')[0]
  })
}

function getWeekDates(offset = 0) {
  const today = new Date()
  const dayOfWeek = (today.getDay() + 6) % 7
  const monday = new Date(today)
  monday.setDate(today.getDate() - dayOfWeek + offset * 7)
  return Array.from({length: 7}, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().split('T')[0]
  })
}

function parseConstraints(message, businessContext, employees) {
  const text = (message + '\n' + businessContext).toLowerCase()
  const empConstraints = {}
  for (const emp of employees) {
    const firstName = emp.full_name.split(' ')[0].toLowerCase()
    const match = text.match(new RegExp(`${firstName}[^.\\n]*?(\\d+)\\s*h`, 'i'))
    if (match) empConstraints[emp.id] = { maxHours: parseInt(match[1]) }
  }
  return empConstraints
}

function generateSchedule(employees, weekDates, openingHours, constraints) {
  const shifts = []
  const empWorkDays = {}
  const empTotalHours = {}
  const empRotation = {}
  const MAX_WORK_DAYS = 5

  employees.forEach((emp, idx) => {
    empWorkDays[emp.id] = 0
    empTotalHours[emp.id] = 0
    empRotation[emp.id] = idx % 2 === 0 ? 'matin' : 'soir'
  })

  for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
    const date = weekDates[dayIdx]
    const hours = openingHours[dayIdx]
    if (!hours) continue

    const { open, close } = hours
    const totalMins = close - open
    const isSaturday = dayIdx === 5
    const isLateClose = close > 22 * 60

    const splitPoint = Math.min(open + Math.ceil(totalMins * 0.55), 17 * 60)
    const morningSlot = { start: open, end: splitPoint, type: 'matin', mins: splitPoint - open }
    const eveningSlot = { start: splitPoint, end: close, type: 'soir', mins: close - splitPoint }

    const available = employees.filter(emp => {
      if (empWorkDays[emp.id] >= MAX_WORK_DAYS) return false
      const maxH = constraints[emp.id]?.maxHours
      if (maxH && empTotalHours[emp.id] >= maxH) return false
      return true
    })
    if (available.length === 0) continue

    const morningFirst = available.filter(e => empRotation[e.id] === 'matin')
    const eveningFirst = available.filter(e => empRotation[e.id] === 'soir')
    const assigned = new Set()

    // MATIN
    const morningNeeded = isSaturday ? 2 : 1
    for (const emp of [...morningFirst, ...eveningFirst]) {
      if (assigned.size >= morningNeeded + (isLateClose ? 1 : 0)) break
      if (assigned.has(emp.id)) continue
      const maxH = constraints[emp.id]?.maxHours
      if (maxH && empTotalHours[emp.id] + morningSlot.mins / 60 > maxH) continue
      if (assigned.size < morningNeeded) {
        shifts.push({ employee_id: emp.id, date, shift_type: 'matin', start_time: minsToTime(morningSlot.start), end_time: minsToTime(morningSlot.end) })
        empTotalHours[emp.id] += morningSlot.mins / 60
        assigned.add(emp.id)
      }
    }

    // SOIR
    const eveningNeeded = isLateClose ? 2 : 1
    for (const emp of [...eveningFirst, ...morningFirst]) {
      if (assigned.has(emp.id)) continue
      const maxH = constraints[emp.id]?.maxHours
      if (maxH && empTotalHours[emp.id] + eveningSlot.mins / 60 > maxH) continue
      shifts.push({ employee_id: emp.id, date, shift_type: 'soir', start_time: minsToTime(eveningSlot.start), end_time: minsToTime(eveningSlot.end % (24*60)) })
      empTotalHours[emp.id] += eveningSlot.mins / 60
      assigned.add(emp.id)
      if (assigned.size >= morningNeeded + eveningNeeded) break
    }

    for (const emp of employees) {
      if (assigned.has(emp.id)) {
        empWorkDays[emp.id]++
        empRotation[emp.id] = empRotation[emp.id] === 'matin' ? 'soir' : 'matin'
      }
    }
  }
  return shifts
}

export async function POST(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

    const { message, employees, business_id } = await request.json()

    const { data: settingsData } = await supabase.from('settings').select('*')
    const settings = {}
    settingsData?.forEach(row => { settings[row.key] = row.value })

    const biz = business_id || 'default'
    const businessContext = settings[`business_context_${biz}`] || settings.business_context || ''
    const openingHoursText = settings[`opening_hours_${biz}`] || settings.opening_hours || ''
    const openingHours = parseOpeningHours(openingHoursText)

    const today = new Date().toISOString().split('T')[0]

    // IA détecte l'intention ET la date précise si mentionnée
    const intentRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 150,
        messages: [{ role: 'user', content: `Aujourd'hui: ${today}
Analyse cette demande et réponds UNIQUEMENT avec un JSON.
Si une date précise est mentionnée (ex: "13 juillet", "semaine du 20"), utilise target_date avec le format YYYY-MM-DD du lundi de cette semaine.
Sinon utilise week_offset (0=cette semaine, 1=prochaine, -1=dernière).

{"action":"create","week_offset":0} OU
{"action":"create","target_date":"2026-07-13"} OU  
{"action":"delete","week_offset":0} OU
{"action":"delete","target_date":"2026-07-13"}

Demande: "${message}"` }]
      })
    })

    const intentData = await intentRes.json()
    const intentText = intentData.content[0].text.trim()
    const intentMatch = intentText.match(/\{[\s\S]*\}/)
    const intent = intentMatch ? JSON.parse(intentMatch[0]) : { action: 'create', week_offset: 0 }

    // Calculer les dates de la semaine
    let weekDates
    if (intent.target_date) {
      weekDates = getWeekDatesFromDate(intent.target_date)
    } else {
      weekDates = getWeekDates(intent.week_offset || 0)
    }

    if (intent.action === 'delete') {
      await supabase.from('shifts').delete()
        .eq('business_id', business_id)
        .in('employee_id', employees.map(e => e.id))
        .gte('date', weekDates[0])
        .lte('date', weekDates[6])
      return Response.json({ success: true, message: `Horaires supprimés du ${weekDates[0]} au ${weekDates[6]}`, count: 0 })
    }

    const constraints = parseConstraints(message, businessContext, employees)
    const generatedShifts = generateSchedule(employees, weekDates, openingHours, constraints)

    await supabase.from('shifts').delete()
      .eq('business_id', business_id)
      .in('employee_id', employees.map(e => e.id))
      .gte('date', weekDates[0])
      .lte('date', weekDates[6])

    const toInsert = generatedShifts.map(s => ({ ...s, business_id: business_id || null }))
    const { error } = await supabase.from('shifts').insert(toInsert)
    if (error) return Response.json({ error: error.message }, { status: 500 })

    return Response.json({ success: true, message: `Planning du ${weekDates[0]} au ${weekDates[6]} : ${toInsert.length} shifts créés`, count: toInsert.length })

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
