import { createClient } from '../../../utils/supabase/server'

function parseOpeningHours(text) {
  const result = {}
  const lines = text.toLowerCase().split('\n').filter(l => l.trim())
  
  const dayMap = {
    'lundi': [0], 'mardi': [1], 'mercredi': [2], 'jeudi': [3],
    'vendredi': [4], 'samedi': [5], 'dimanche': [6],
    'lundi - mercredi': [0,1,2], 'lundi – mercredi': [0,1,2],
    'lundi - vendredi': [0,1,2,3,4], 'lundi – vendredi': [0,1,2,3,4]
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
    if (match) {
      empConstraints[emp.id] = { maxHours: parseInt(match[1]) }
    }
  }
  return empConstraints
}

function generateSchedule(employees, weekDates, openingHours, constraints, weekOffset) {
  const shifts = []
  
  // Rotation basée sur la semaine — chaque employé commence par matin ou soir en alternance
  const empRotation = {}
  employees.forEach((emp, idx) => {
    // Alterne : semaine paire = matin en premier, semaine impaire = soir en premier
    const weekNum = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)) + weekOffset
    empRotation[emp.id] = (idx + weekNum) % 2 === 0 ? 'matin' : 'soir'
  })

  const empWorkDays = {}
  const empTotalHours = {}
  employees.forEach(emp => { empWorkDays[emp.id] = 0; empTotalHours[emp.id] = 0 })

  const MAX_WORK_DAYS = 5

  for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
    const date = weekDates[dayIdx]
    const hours = openingHours[dayIdx]
    if (!hours) continue

    const { open, close } = hours
    const totalMins = close - open
    const isSaturday = dayIdx === 5
    const isLateClose = close > 22 * 60 // ferme après 22h

    // Découper la journée en matin et soir
    // Matin : ouverture → 17h (ou mi-journée si ferme tôt)
    // Soir : 17h → fermeture
    const splitPoint = Math.min(open + Math.ceil(totalMins * 0.55), 17 * 60)
    
    const morningSlot = { start: open, end: splitPoint, type: 'matin', mins: splitPoint - open }
    const eveningSlot = { start: splitPoint, end: close, type: 'soir', mins: close - splitPoint }

    // Employés encore disponibles
    const available = employees.filter(emp => {
      if (empWorkDays[emp.id] >= MAX_WORK_DAYS) return false
      const maxH = constraints[emp.id]?.maxHours
      if (maxH && empTotalHours[emp.id] >= maxH) return false
      return true
    })

    if (available.length === 0) continue

    // Trier selon la rotation du jour
    // Employés "matin en premier" ce jour
    const morningFirst = available.filter(e => empRotation[e.id] === 'matin')
    const eveningFirst = available.filter(e => empRotation[e.id] === 'soir')

    const assigned = new Set()

    // SLOT MATIN
    const morningNeeded = isSaturday ? 2 : 1
    const morningCandidates = [...morningFirst, ...eveningFirst]
    
    let morningAssigned = 0
    for (const emp of morningCandidates) {
      if (morningAssigned >= morningNeeded) break
      if (assigned.has(emp.id)) continue
      const maxH = constraints[emp.id]?.maxHours
      if (maxH && empTotalHours[emp.id] + morningSlot.mins / 60 > maxH) continue

      shifts.push({
        employee_id: emp.id,
        date,
        shift_type: 'matin',
        start_time: minsToTime(morningSlot.start),
        end_time: minsToTime(morningSlot.end),
      })
      empTotalHours[emp.id] += morningSlot.mins / 60
      assigned.add(emp.id)
      morningAssigned++
    }

    // SLOT SOIR
    const eveningNeeded = isLateClose ? 2 : 1
    const eveningCandidates = [...eveningFirst, ...morningFirst].filter(e => !assigned.has(e.id))
    
    // Si pas assez pour le soir, prendre aussi ceux du matin si journée courte
    const allForEvening = [...eveningCandidates, ...morningFirst.filter(e => !assigned.has(e.id))]

    let eveningAssigned = 0
    for (const emp of allForEvening) {
      if (eveningAssigned >= eveningNeeded) break
      if (assigned.has(emp.id)) continue
      const maxH = constraints[emp.id]?.maxHours
      if (maxH && empTotalHours[emp.id] + eveningSlot.mins / 60 > maxH) continue

      shifts.push({
        employee_id: emp.id,
        date,
        shift_type: 'soir',
        start_time: minsToTime(eveningSlot.start),
        end_time: minsToTime(eveningSlot.end % (24 * 60)),
      })
      empTotalHours[emp.id] += eveningSlot.mins / 60
      assigned.add(emp.id)
      eveningAssigned++
    }

    // Mettre à jour jours travaillés et inverser rotation pour demain
    for (const emp of employees) {
      if (assigned.has(emp.id)) {
        empWorkDays[emp.id]++
        // Inverser la rotation pour le prochain jour
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

    // IA uniquement pour détecter l'intention et la semaine
    const intentRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 100,
        messages: [{ role: 'user', content: `Analyse cette demande et réponds UNIQUEMENT avec un JSON:
{"action":"create","week_offset":0} pour créer (0=cette semaine, 1=semaine prochaine, -1=semaine dernière)
{"action":"delete","week_offset":0} pour supprimer
Demande: "${message}"` }]
      })
    })

    const intentData = await intentRes.json()
    const intentText = intentData.content[0].text.trim()
    const intentMatch = intentText.match(/\{[\s\S]*\}/)
    const intent = intentMatch ? JSON.parse(intentMatch[0]) : { action: 'create', week_offset: 0 }
    const weekOffset = intent.week_offset || 0
    const weekDates = getWeekDates(weekOffset)

    if (intent.action === 'delete') {
      await supabase.from('shifts').delete()
        .eq('business_id', business_id)
        .in('employee_id', employees.map(e => e.id))
        .gte('date', weekDates[0])
        .lte('date', weekDates[6])
      return Response.json({ success: true, message: 'Horaires supprimés', count: 0 })
    }

    // Parser les contraintes (heures dispo par employé)
    const constraints = parseConstraints(message, businessContext, employees)

    // Générer avec l'algorithme
    const generatedShifts = generateSchedule(employees, weekDates, openingHours, constraints, weekOffset)

    // Supprimer anciens shifts de la semaine
    await supabase.from('shifts').delete()
      .eq('business_id', business_id)
      .in('employee_id', employees.map(e => e.id))
      .gte('date', weekDates[0])
      .lte('date', weekDates[6])

    // Insérer
    const toInsert = generatedShifts.map(s => ({ ...s, business_id: business_id || null }))
    const { error } = await supabase.from('shifts').insert(toInsert)
    if (error) return Response.json({ error: error.message }, { status: 500 })

    return Response.json({ success: true, message: `${toInsert.length} shifts générés`, count: toInsert.length })

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
