import { createClient } from '../../../utils/supabase/server'

function parseOpeningHours(text) {
  const days = { 'lundi': 0, 'mardi': 1, 'mercredi': 2, 'jeudi': 3, 'vendredi': 4, 'samedi': 5, 'dimanche': 6 }
  const result = {}
  const lines = text.toLowerCase().split('\n').filter(l => l.trim())
  for (const line of lines) {
    const timeMatch = line.match(/(\d{1,2})h(\d{0,2})\s*[-–]\s*(\d{1,2})h(\d{0,2})/)
    if (!timeMatch) continue
    const open = `${timeMatch[1].padStart(2,'0')}:${(timeMatch[2]||'00').padStart(2,'0')}:00`
    const close = `${timeMatch[3].padStart(2,'0')}:${(timeMatch[4]||'00').padStart(2,'0')}:00`
    for (const [dayName, dayIdx] of Object.entries(days)) {
      if (line.includes(dayName)) result[dayIdx] = { open, close }
    }
    if (line.includes('lundi') && line.includes('mercredi')) {
      result[0] = { open, close }; result[1] = { open, close }; result[2] = { open, close }
    }
    if (line.includes('lundi') && line.includes('vendredi')) {
      for (let i = 0; i <= 4; i++) result[i] = { open, close }
    }
  }
  return result
}

function getWeekDates(offsetFromToday = 0) {
  const today = new Date()
  const dayOfWeek = (today.getDay() + 6) % 7
  const monday = new Date(today)
  monday.setDate(today.getDate() - dayOfWeek + offsetFromToday * 7)
  return Array.from({length: 7}, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().split('T')[0]
  })
}

function timeToMins(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minsToTime(m) {
  const h = Math.floor(m / 60) % 24
  const min = m % 60
  return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}:00`
}

function generateSchedule(employees, weekDates, openingHours, constraints) {
  const shifts = []
  const empWorkDays = {}
  const empHours = {}
  const empLastSlot = {}
  
  for (const emp of employees) {
    empWorkDays[emp.id] = 0
    empHours[emp.id] = 0
    empLastSlot[emp.id] = null
  }

  // Parse disponibilités spéciales depuis constraints
  const empMaxHours = {}
  for (const emp of employees) {
    const nameMatch = constraints.match(new RegExp(`${emp.full_name.split(' ')[0]}[^\\n]*?(\\d+)h`, 'i'))
    if (nameMatch) empMaxHours[emp.id] = parseInt(nameMatch[1])
  }

  const maxWorkDays = 5 // 2 jours de repos minimum

  for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
    const date = weekDates[dayIdx]
    const dayHours = openingHours[dayIdx]
    if (!dayHours) continue

    const openMins = timeToMins(dayHours.open)
    let closeMins = timeToMins(dayHours.close)
    if (closeMins <= openMins) closeMins += 24 * 60 // après minuit

    const totalMins = closeMins - openMins
    const isSaturday = dayIdx === 5
    const isLateNight = closeMins > 22 * 60 // fermeture après 22h

    // Créer les créneaux de la journée
    const slots = []
    if (totalMins <= 8 * 60) {
      slots.push({ start: openMins, end: closeMins, type: openMins < 14 * 60 ? 'matin' : 'soir' })
    } else {
      const mid = openMins + Math.floor(totalMins / 2)
      slots.push({ start: openMins, end: mid, type: 'matin' })
      slots.push({ start: mid, end: closeMins, type: 'soir' })
    }

    // Employés disponibles ce jour
    const available = employees.filter(emp => {
      if (empWorkDays[emp.id] >= maxWorkDays) return false
      if (empMaxHours[emp.id] && empHours[emp.id] >= empMaxHours[emp.id]) return false
      return true
    })

    if (available.length === 0) continue

    // Assigner les slots
    for (let slotIdx = 0; slotIdx < slots.length; slotIdx++) {
      const slot = slots[slotIdx]
      const slotMins = slot.end - slot.start
      const slotKey = `${slot.start}-${slot.end}`

      // Nombre d'employés requis pour ce slot
      let required = 1
      if (isSaturday) required = 2
      if (isLateNight && slotIdx === slots.length - 1) required = Math.min(2, available.length)

      // Trier les employés par rotation (ceux qui ont fait ce slot récemment passent en dernier)
      const sorted = [...available].sort((a, b) => {
        const aLast = empLastSlot[a.id] === slotKey ? 1 : 0
        const bLast = empLastSlot[b.id] === slotKey ? 1 : 0
        const aHours = empHours[a.id]
        const bHours = empHours[b.id]
        return (aLast - bLast) || (aHours - bHours)
      })

      let assigned = 0
      for (const emp of sorted) {
        if (assigned >= required) break
        if (empWorkDays[emp.id] >= maxWorkDays) continue
        if (empMaxHours[emp.id] && empHours[emp.id] + slotMins / 60 > empMaxHours[emp.id]) continue

        const startTime = minsToTime(slot.start % (24 * 60))
        const endTime = minsToTime(slot.end % (24 * 60))

        shifts.push({
          employee_id: emp.id,
          date,
          shift_type: slot.type,
          start_time: startTime,
          end_time: endTime,
          business_id: null
        })

        empHours[emp.id] += slotMins / 60
        empLastSlot[emp.id] = slotKey
        assigned++
      }

      // Si pas assez d'employés assignés et qu'il y en a avec max dépassé, on les force
      if (assigned < 1) {
        const forced = employees.find(e => !shifts.some(s => s.employee_id === e.id && s.date === date))
        if (forced) {
          shifts.push({
            employee_id: forced.id,
            date,
            shift_type: slot.type,
            start_time: minsToTime(slot.start % (24 * 60)),
            end_time: minsToTime(slot.end % (24 * 60)),
            business_id: null
          })
        }
      }
    }

    // Incrémenter jours travaillés
    for (const emp of employees) {
      if (shifts.some(s => s.employee_id === emp.id && s.date === date)) {
        empWorkDays[emp.id]++
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

    // Utiliser l'IA uniquement pour comprendre l'intention
    const intentPrompt = `Analyse cette demande et réponds UNIQUEMENT avec un JSON:
{"action":"create","week_offset":0} si on veut créer les horaires (0=cette semaine, 1=semaine prochaine, -1=semaine dernière)
{"action":"delete","week_offset":0} si on veut supprimer les horaires

Demande: "${message}"
Réponds uniquement avec le JSON, rien d'autre.`

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
        messages: [{ role: 'user', content: intentPrompt }]
      })
    })

    const intentData = await intentRes.json()
    const intentText = intentData.content[0].text.trim()
    const intentMatch = intentText.match(/\{[\s\S]*\}/)
    const intent = intentMatch ? JSON.parse(intentMatch[0]) : { action: 'create', week_offset: 0 }

    const weekDates = getWeekDates(intent.week_offset || 0)
    const openingHours = parseOpeningHours(openingHoursText)

    if (intent.action === 'delete') {
      await supabase.from('shifts').delete()
        .eq('business_id', business_id)
        .in('employee_id', employees.map(e => e.id))
        .gte('date', weekDates[0])
        .lte('date', weekDates[6])
      return Response.json({ success: true, message: 'Horaires supprimés', count: 0 })
    }

    // Générer les shifts avec l'algorithme
    const generatedShifts = generateSchedule(employees, weekDates, openingHours, businessContext + '\n' + message)

    // Supprimer les anciens shifts de la semaine
    await supabase.from('shifts').delete()
      .eq('business_id', business_id)
      .in('employee_id', employees.map(e => e.id))
      .gte('date', weekDates[0])
      .lte('date', weekDates[6])

    // Insérer les nouveaux
    const shiftsToInsert = generatedShifts.map(s => ({ ...s, business_id: business_id || null }))
    const { error: insertError } = await supabase.from('shifts').insert(shiftsToInsert)
    if (insertError) return Response.json({ error: insertError.message }, { status: 500 })

    return Response.json({ success: true, message: `Planning généré : ${shiftsToInsert.length} shifts créés`, count: shiftsToInsert.length })

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
