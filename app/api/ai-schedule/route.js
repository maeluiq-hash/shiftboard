import { createClient } from '../../../utils/supabase/server'

export async function POST(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

    const { message, employees, business_id } = await request.json()
    const employeeList = employees.map(e => `- ${e.full_name} (employee_id: "${e.id}")`).join('\n')

    const { data: settingsData } = await supabase.from('settings').select('*')
    const settings = {}
    settingsData?.forEach(row => { settings[row.key] = row.value })

    const biz = business_id || 'default'
    const businessContext = settings[`business_context_${biz}`] || settings.business_context || ''
    const openingHours = settings[`opening_hours_${biz}`] || settings.opening_hours || ''

    const today = new Date().toISOString().split('T')[0]

    const prompt = `Tu es un assistant de planification pour un bar/restaurant.
AUJOURD'HUI: ${today}

EMPLOYÉS:
${employeeList}

${openingHours ? `HORAIRES D'OUVERTURE:\n${openingHours}` : ''}
${businessContext ? `CONTEXTE:\n${businessContext}` : ''}

RÈGLES OBLIGATOIRES:
- Si la demande est de SUPPRIMER ou EFFACER des horaires, réponds avec action "delete" et une plage de dates
- Si la demande est de CRÉER des horaires, crée des shifts pour TOUS les employés sans exception
- Chaque employé doit avoir au minimum 3 shifts dans la semaine
- shift_type: "matin", "soir", ou "coupure"
- start_time et end_time au format "HH:MM:SS"
- date au format "YYYY-MM-DD"
- Utilise EXACTEMENT les employee_id fournis ci-dessus
- 2 jours de repos minimum par employé
- Réponds UNIQUEMENT avec un JSON valide, zéro texte avant ou après, zéro backticks

FORMAT JSON POUR CRÉER:
{"action":"create","message":"résumé court","shifts":[{"employee_id":"ID_EXACT","date":"YYYY-MM-DD","shift_type":"matin","start_time":"HH:MM:SS","end_time":"HH:MM:SS"}]}

FORMAT JSON POUR SUPPRIMER:
{"action":"delete","message":"résumé court","date_from":"YYYY-MM-DD","date_to":"YYYY-MM-DD"}

DEMANDE: ${message}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    if (!response.ok) {
      const err = await response.text()
      return Response.json({ error: 'Erreur API: ' + err }, { status: 500 })
    }

    const aiData = await response.json()
    const text = aiData.content[0].text.trim()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return Response.json({ error: 'Réponse IA invalide: ' + text }, { status: 500 })

    const parsed = JSON.parse(jsonMatch[0])

    if (parsed.action === 'delete') {
      const { error: deleteError } = await supabase.from('shifts')
        .delete()
        .eq('business_id', business_id)
        .in('employee_id', employees.map(e => e.id))
        .gte('date', parsed.date_from)
        .lte('date', parsed.date_to)

      if (deleteError) return Response.json({ error: deleteError.message }, { status: 500 })
      return Response.json({ success: true, message: parsed.message, count: 0 })
    }

    if (parsed.action === 'create' || parsed.shifts) {
      if (business_id) {
        await supabase.from('shifts').delete()
          .eq('business_id', business_id)
          .in('employee_id', employees.map(e => e.id))
          .gte('date', parsed.shifts[0]?.date || '2026-01-01')
          .lte('date', parsed.shifts[parsed.shifts.length-1]?.date || '2099-01-01')
      }

      const { error: insertError } = await supabase.from('shifts').insert(
        parsed.shifts.map(s => ({
          employee_id: s.employee_id,
          date: s.date,
          shift_type: s.shift_type,
          start_time: s.start_time,
          end_time: s.end_time,
          business_id: business_id || null
        }))
      )

      if (insertError) return Response.json({ error: insertError.message }, { status: 500 })
      return Response.json({ success: true, message: parsed.message, count: parsed.shifts.length })
    }

    return Response.json({ error: 'Action non reconnue' }, { status: 400 })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
