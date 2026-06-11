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

function generateSchedule(employees, weekDates, openingHours, constraints, weekNumber) {
  const shifts = []
  const n = employees.length

  // Attribuer 2 jours de repos consécutifs qui tournent chaque semaine
  const restPatterns = [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,0]]
  const empRestDays = {}

  for (let i = 0; i < n; i++) {
    const patternIdx = (i + weekNumber) % restPatterns.length
    empRestDays[employees[i].id] = [...restPatterns[patternIdx]]
  }

  // Vérifier couverture minimale chaque jour (au moins 2 employés dispo)
  for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
    if (!openingHours[dayIdx]) continue
    const isSaturday = dayIdx === 5
    const minNeeded = isSaturday ? 3 : 2 // sam besoin de plus pour le renfort

    const working = employees.filter(e => !empRestDays[e.id].includes(dayIdx))
    if (working.length >= minNeeded) continue

    // Déplacer le repos d'un employé
    for (const emp of employees) {
      if (!empRestDays[emp.id].includes(dayIdx)) continue
      for (let altDay = 0; altDay < 7; altDay++) {
        if (empRestDays[emp.id].includes(altDay)) continue
        const othersWorking = employees.filter(e =>
          e.id !== emp.id && !empRestDays[e.id].includes(altDay)
        ).length
        if (othersWorking >= 2) {
          const oldRest = empRestDays[emp.id]
          const keep = oldRest.find(d => d !== dayIdx) ?? (altDay + 1) % 7
          // Garder les 2 jours consécutifs
          const newRest = [altDay, (altDay + 1) % 7]
          empRestDays[emp.id] = newRest
          break
        }
      }
      const nowWorking = employees.filter(e => !empRestDays[e.id].includes(dayIdx))
      if (nowWorking.length >= minNeeded) break
    }
  }

  // Générer les shifts jour par jour
  for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
    const date = weekDates[dayIdx]
    const hours = openingHours[dayIdx]
    if (!hours) continue

    const { open, close } = hours
    const totalMins = close - open
    const isFriday = dayIdx === 4
    const isSaturday = dayIdx === 5

    // Split matin/soir arrondi à l'heure
    const rawSplit = open + Math.round(totalMins * 0.55 / 60) * 60
    const splitPoint = Math.min(rawSplit, 17 * 60)

    // Employés qui travaillent ce jour
    const workingEmps = employees.filter(e => !empRestDays[e.id].includes(dayIdx))
    if (workingEmps.length === 0) continue

    // Définir les slots du jour
    const slots = []

    // Slot matin
    slots.push({
      start: open,
      end: splitPoint,
      type: 'matin',
      needed: isSaturday ? 2 : 1
    })

    // Slot soir normal
    slots.push({
      start: splitPoint,
      end: close,
      type: 'soir',
      needed: 1
    })

    // Slot renfort vendredi et samedi : 19h-23h
    if (isFriday || isSaturday) {
      slots.push({
        start: 19 * 60,
        end: 23 * 60,
        type: 'soir',
        needed: 1,
        isRenfort: true
      })
    }

    // Rotation matin/soir par employé
    const assignedThisDay = new Set()
    const slotAssignments = {}

    for (const slot of slots) {
      slotAssignments[`${slot.start}-${slot.end}`] = []

      // Trier : priorité aux employés pas encore assignés ce jour
      const candidates = workingEmps.sort((a, b) => {
        const aIdx = employees.findIndex(e => e.id === a.id)
        const bIdx = employees.findIndex(e => e.id === b.id)
        const aAssigned = assignedThisDay.has(a.id) ? 10 : 0
        const bAssigned = assignedThisDay.has(b.id) ? 10 : 0
        // Rotation matin/soir
        const aPref = (aIdx + dayIdx + weekNumber) % 2 === 0 ? 'matin' : 'soir'
        const bPref = (bIdx + dayIdx + weekNumber) % 2 === 0 ? 'matin' : 'soir'
        const aMatch = aPref === slot.type ? 0 : 1
        const bMatch = bPref === slot.type ? 0 : 1
        return (aAssigned + aMatch) - (bAssigned + bMatch)
      })

      let assigned = 0
      for (const emp of candidates) {
        if (assigned >= slot.needed) break
        // Pour le renfort, ne pas prendre quelqu'un déjà sur le soir normal
        if (slot.isRenfort && assignedThisDay.has(emp.id)) continue

        shifts.push({
          employee_id: emp.id,
          date,
          shift_type: slot.type,
          start_time: minsToTime(slot.start),
          end_time: minsToTime(slot.end % (24*60))
        })
        assignedThisDay.add(emp.id)
        assigned++
      }

      // Si toujours pas assez (renfort), forcer quelqu'un
      if (assigned < slot.needed) {
        for (const emp of workingEmps) {
          if (assigned >= slot.needed) break
          if (slot.isRenfort && assignedThisDay.has(emp.id)) continue
          shifts.push({
            employee_id: emp.id,
            date,
            shift_type: slot.type,
            start_time: minsToTime(slot.start),
            end_time: minsToTime(slot.end % (24*60))
          })
          assignedThisDay.add(emp.id)
          assigned++
        }
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
Si date précise: {"action":"create","target_date":"YYYY-MM-DD"} (lundi de la semaine visée)
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

    const weekNumber = Math.floor(new Date(weekDates[0]).getTime() / (7 * 24 * 60 * 60 * 1000))

    if (intent.action === 'delete') {
      await supabase.from('shifts').delete()
        .eq('business_id', business_id)
        .in('employee_id', employees.map(e => e.id))
        .gte('date', weekDates[0])
        .lte('date', weekDates[6])
      return Response.json({ success: true, message: 'Horaires supprimés', count: 0 })
    }

    const constraints = parseConstraints(message, employees)
    const generatedShifts = generateSchedule(employees, weekDates, openingHours, constraints, weekNumber)

    await supabase.from('shifts').delete()
      .eq('business_id', business_id)
      .in('employee_id', employees.map(e => e.id))
      .gte('date', weekDates[0])
      .lte('date', weekDates[6])

    const toInsert = generatedShifts.map(s => ({ ...s, business_id: business_id || null }))
    const { error } = await supabase.from('shifts').insert(toInsert)
    if (error) return Response.json({ error: error.message }, { status: 500 })

    return Response.json({ success: true, message: `Planning ${weekDates[0]} → ${weekDates[6]} : ${toInsert.length} shifts`, count: toInsert.length })

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
