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
  if (n === 0) return shifts

  // Templates de shifts par type de jour, basés sur le fonctionnement réel de Barbacane
  // Chaque jour normal : 1 shift matin (6-7h) + 1 shift soir (4-5h)
  // Vendredi : matin + soir + renfort 19h-23h
  // Samedi : 2 matin (9h-17h et 9h-13h) + soir + renfort 19h-23h
  // Dimanche : matin + soir

  const empRestDays = {}
  const restPatterns = [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,0]]
  for (let i = 0; i < n; i++) {
    const patternIdx = (i + weekNumber) % restPatterns.length
    empRestDays[employees[i].id] = [...restPatterns[patternIdx]]
  }

  // S'assurer d'une couverture minimale (3 dispo samedi, 2 les autres jours)
  for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
    if (!openingHours[dayIdx]) continue
    const isSaturday = dayIdx === 5
    const minNeeded = isSaturday ? 3 : 2
    const working = employees.filter(e => !empRestDays[e.id].includes(dayIdx))
    if (working.length >= minNeeded) continue
    for (const emp of employees) {
      if (!empRestDays[emp.id].includes(dayIdx)) continue
      for (let altDay = 0; altDay < 7; altDay++) {
        if (empRestDays[emp.id].includes(altDay)) continue
        const othersWorking = employees.filter(e => e.id !== emp.id && !empRestDays[e.id].includes(altDay)).length
        if (othersWorking >= 2) {
          empRestDays[emp.id] = [altDay, (altDay + 1) % 7]
          break
        }
      }
      const nowWorking = employees.filter(e => !empRestDays[e.id].includes(dayIdx))
      if (nowWorking.length >= minNeeded) break
    }
  }

  const empTotalMins = {}
  employees.forEach(e => { empTotalMins[e.id] = 0 })

  function pickBest(candidates, slotType, dayIdx, exclude) {
    const pool = candidates.filter(e => !exclude.has(e.id))
    if (pool.length === 0) return null
    return pool.sort((a, b) => {
      const aIdx = employees.findIndex(e => e.id === a.id)
      const bIdx = employees.findIndex(e => e.id === b.id)
      const aPref = (aIdx + dayIdx + weekNumber) % 2 === 0 ? 'matin' : 'soir'
      const bPref = (bIdx + dayIdx + weekNumber) % 2 === 0 ? 'matin' : 'soir'
      const aMatch = aPref === slotType ? 0 : 1
      const bMatch = bPref === slotType ? 0 : 1
      const aMin = a.min_hours || 0
      const bMin = b.min_hours || 0
      const aBehind = aMin > 0 && (empTotalMins[a.id] / 60) < aMin ? -5 : 0
      const bBehind = bMin > 0 && (empTotalMins[b.id] / 60) < bMin ? -5 : 0
      const aMax = a.max_hours
      const bMax = b.max_hours
      const aOver = aMax && (empTotalMins[a.id] / 60) >= aMax ? 8 : 0
      const bOver = bMax && (empTotalMins[b.id] / 60) >= bMax ? 8 : 0
      return (aMatch + aBehind + aOver) - (bMatch + bBehind + bOver)
    })[0]
  }

  for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
    const date = weekDates[dayIdx]
    const hours = openingHours[dayIdx]
    if (!hours) continue
    const { open, close } = hours
    const isFriday = dayIdx === 4
    const isSaturday = dayIdx === 5

    const workingEmps = employees.filter(e => !empRestDays[e.id].includes(dayIdx))
    if (workingEmps.length === 0) continue

    const assignedToday = new Set()
    const closeH = close % (24*60)

    function addShift(emp, startMin, endMin, type) {
      shifts.push({
        employee_id: emp.id,
        date,
        shift_type: type,
        start_time: minsToTime(startMin),
        end_time: minsToTime(endMin % (24*60))
      })
      empTotalMins[emp.id] += (endMin - startMin)
      assignedToday.add(emp.id)
    }

    if (isSaturday) {
      // 2 personnes le matin : une longue (open -> close-X), une courte (open -> open+4h)
      const morningLongEnd = open + 8 * 60 // 8h de shift
      const morningShortEnd = open + 4 * 60 // 4h de shift
      const emp1 = pickBest(workingEmps, 'matin', dayIdx, assignedToday)
      if (emp1) addShift(emp1, open, Math.min(morningLongEnd, close), 'matin')
      const emp2 = pickBest(workingEmps, 'matin', dayIdx, assignedToday)
      if (emp2) addShift(emp2, open, Math.min(morningShortEnd, close), 'matin')

      // Soir : 17h -> close
      const eveningStart = Math.max(17 * 60, morningShortEnd)
      const emp3 = pickBest(workingEmps, 'soir', dayIdx, assignedToday)
      if (emp3) addShift(emp3, eveningStart, close, 'soir')

      // Renfort 19h-23h
      const emp4 = pickBest(workingEmps, 'soir', dayIdx, assignedToday)
      if (emp4) addShift(emp4, 19 * 60, 23 * 60, 'soir')

    } else if (isFriday) {
      // Matin classique
      const morningEnd = Math.min(open + 6 * 60, 17 * 60)
      const emp1 = pickBest(workingEmps, 'matin', dayIdx, assignedToday)
      if (emp1) addShift(emp1, open, morningEnd, 'matin')

      // Soir classique
      const emp2 = pickBest(workingEmps, 'soir', dayIdx, assignedToday)
      if (emp2) addShift(emp2, morningEnd, close, 'soir')

      // Renfort 19h-23h
      const emp3 = pickBest(workingEmps, 'soir', dayIdx, assignedToday)
      if (emp3) addShift(emp3, 19 * 60, 23 * 60, 'soir')

    } else {
      // Jour normal : 1 matin + 1 soir
      const morningEnd = Math.min(open + 6 * 60, 17 * 60)
      const emp1 = pickBest(workingEmps, 'matin', dayIdx, assignedToday)
      if (emp1) addShift(emp1, open, morningEnd, 'matin')

      const emp2 = pickBest(workingEmps, 'soir', dayIdx, assignedToday)
      if (emp2) addShift(emp2, morningEnd, close, 'soir')
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

    // Détecter si c'est une suppression globale sans passer par l'IA
    const msgLower = message.toLowerCase()
    const isDeleteAll = msgLower.includes('tout') && msgLower.includes('supprim')

    if (isDeleteAll) {
      const { error } = await supabase.from('shifts')
        .delete()
        .eq('business_id', business_id)
        .in('employee_id', employees.map(e => e.id))
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ success: true, message: 'Tous les horaires supprimés', count: 0 })
    }

    const intentRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 150,
        messages: [{ role: 'user', content: `Aujourd'hui: ${today}
Réponds UNIQUEMENT avec un JSON.
Si date précise: {"action":"create","target_date":"YYYY-MM-DD"} (lundi de la semaine visée)
Sinon: {"action":"create","week_offset":0} (0=cette semaine, 1=prochaine, -1=dernière)
Pour suppression d'une semaine: même format avec "delete"
Demande: "${message}"` }]
      })
    })

    const intentData = await intentRes.json()
    if (!intentRes.ok || !intentData.content) {
      return Response.json({ error: 'Erreur API Claude: ' + JSON.stringify(intentData) }, { status: 500 })
    }
    const intentText = intentData.content[0].text.trim()
    const intentMatch = intentText.match(/\{[\s\S]*\}/)
    const intent = intentMatch ? JSON.parse(intentMatch[0]) : { action: 'create', week_offset: 0 }

    let weekDates
    if (intent.target_date && intent.target_date !== 'null') {
      weekDates = getWeekDatesFromDate(intent.target_date)
    } else {
      weekDates = getWeekDates(intent.week_offset || 0)
    }

    const weekNumber = Math.floor(new Date(weekDates[0]).getTime() / (7 * 24 * 60 * 60 * 1000))

    if (intent.action === 'delete') {
      await supabase.from('shifts').delete()
        .eq('business_id', business_id)
        .in('employee_id', employees.map(e => e.id))
        .gte('date', weekDates[0])
        .lte('date', weekDates[6])
      return Response.json({ success: true, message: `Horaires supprimés du ${weekDates[0]} au ${weekDates[6]}`, count: 0 })
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
