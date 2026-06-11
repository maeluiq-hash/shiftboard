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
    const closeAdj = close <= open ? close + 24*60 : close
    for (const [key, days] of Object.entries(dayMap)) {
      if (line.includes(key)) {
        for (const d of days) result[d] = { open, close: closeAdj }
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

function parseConstraints(message, employees) {
  const empConstraints = {}
  for (const emp of employees) {
    const firstName = emp.full_name.split(' ')[0].toLowerCase()
    const match = message.toLowerCase().match(new RegExp(`${firstName}[^.\\n]*?(\\d+)\\s*h`, 'i'))
    if (match) empConstraints[emp.id] = { maxHours: parseInt(match[1]) }
  }
  return empConstraints
}

function generateSchedule(employees, weekDates, openingHours, constraints) {
  const shifts = []
  const empWorkDays = {}
  const empTotalMins = {}
  const MAX_WORK_DAYS = 5

  employees.forEach(emp => {
    empWorkDays[emp.id] = 0
    empTotalMins[emp.id] = 0
  })

  // Pour chaque jour, on crée les slots et on les remplit
  for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
    const date = weekDates[dayIdx]
    const hours = openingHours[dayIdx]
    if (!hours) continue

    const { open, close } = hours
    const totalMins = close - open
    const isSaturday = dayIdx === 5
    const isLateClose = close > 22 * 60

    // Arrondir le split à l'heure la plus proche
    const rawSplit = open + Math.round(totalMins * 0.55 / 60) * 60
    const splitPoint = Math.min(rawSplit, 17 * 60)

    // Slots de la journée
    const slots = [
      { start: open, end: splitPoint, type: 'matin', needed: isSaturday ? 2 : 1 },
      { start: splitPoint, end: close, type: 'soir', needed: isLateClose ? 2 : 1 }
    ]

    // Employés disponibles triés par nb de jours travaillés (moins = priorité)
    const getAvailable = () => employees
      .filter(emp => {
        if (empWorkDays[emp.id] >= MAX_WORK_DAYS) return false
        const maxH = constraints[emp.id]?.maxHours
        if (maxH && empTotalMins[emp.id] / 60 >= maxH) return false
        return true
      })
      .sort((a, b) => empWorkDays[a.id] - empWorkDays[b.id])

    const dayAssigned = new Set()

    for (const slot of slots) {
      const slotMins = slot.end - slot.start
      let assigned = 0

      // D'abord les employés qui ne travaillent pas encore ce jour
      const candidates = getAvailable().sort((a, b) => {
        const aWorking = dayAssigned.has(a.id) ? 1 : 0
        const bWorking = dayAssigned.has(b.id) ? 1 : 0
        return aWorking - bWorking || empWorkDays[a.id] - empWorkDays[b.id]
      })

      for (const emp of candidates) {
        if (assigned >= slot.needed) break
        // Éviter de mettre quelqu'un sur 2 slots le même jour sauf si nécessaire
        if (dayAssigned.has(emp.id) && assigned === 0 && candidates.filter(e => !dayAssigned.has(e.id)).length > 0) continue
        
        const maxH = constraints[emp.id]?.maxHours
        if (maxH && (empTotalMins[emp.id] + slotMins) / 60 > maxH) continue

        shifts.push({
          employee_id: emp.id,
          date,
          shift_type: slot.type,
          start_time: minsToTime(slot.start),
          end_time: minsToTime(slot.end % (24*60))
        })
        empTotalMins[emp.id] += slotMins
        dayAssigned.add(emp.id)
        assigned++
      }

      // Si on n'a pas assez de monde, on force avec ceux qui travaillent déjà
      if (assigned < slot.needed) {
        const remaining = getAvailable().filter(e => !dayAssigned.has(e.id) || assigned < 1)
        for (const emp of remaining) {
          if (assigned >= slot.needed) break
          if (dayAssigned.has(emp.id)) continue
          shifts.push({
            employee_id: emp.id,
            date,
            shift_type: slot.type,
            start_time: minsToTime(slot.start),
            end_time: minsToTime(slot.end % (24*60))
          })
          empTotalMins[emp.id] += slotMins
          dayAssigned.add(emp.id)
          assigned++
        }
      }
    }

    // Mettre à jour les jours travaillés
    for (const empId of dayAssigned) {
      empWorkDays[empId]++
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
    const openingHoursText = settings[`opening_hours_${biz}`] || settings.opening_hours || ''
    const openingHours = parseOpeningHours(openingHoursText)

    const today = new Date().toISOString().split('T')[0]

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
Réponds UNIQUEMENT avec un JSON.
Si date précise mentionnée: {"action":"create","target_date":"YYYY-MM-DD"} (lundi de la semaine)
Sinon: {"action":"create","week_offset":0} (0=cette semaine, 1=prochaine, -1=dernière)
Pour suppression: même format avec "delete"
Demande: "${message}"` }]
      })
    })

    const intentData = await intentRes.json()
    const intentText = intentData.content[0].text.trim()
    const intentMatch = intentText.match(/\{[\s\S]*\}/)
    const intent = intentMatch ? JSON.parse(intentMatch[0]) : { action: 'create', week_offset: 0 }

    const weekDates = intent.target_date
      ? getWeekDatesFromDate(intent.target_date)
      : getWeekDates(intent.week_offset || 0)

    if (intent.action === 'delete') {
      await supabase.from('shifts').delete()
        .eq('business_id', business_id)
        .in('employee_id', employees.map(e => e.id))
        .gte('date', weekDates[0])
        .lte('date', weekDates[6])
      return Response.json({ success: true, message: `Horaires supprimés du ${weekDates[0]} au ${weekDates[6]}`, count: 0 })
    }

    const constraints = parseConstraints(message, employees)
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
