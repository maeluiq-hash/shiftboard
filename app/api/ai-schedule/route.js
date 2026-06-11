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

    const prompt = `Tu es un logiciel de planification automatique pour un bar/restaurant.
AUJOURD'HUI: ${today}

EMPLOYÉS (crée des shifts pour CHACUN sans exception):
${employeeList}

HORAIRES D'OUVERTURE DU BAR (les shifts doivent être DANS ces plages):
${openingHours}

RÈGLES STRICTES DE L'ÉTABLISSEMENT (tu DOIS les respecter à la lettre):
${businessContext}

CONTRAINTES TECHNIQUES OBLIGATOIRES:
1. Crée des shifts pour TOUS les employés listés
2. Chaque shift doit être DANS les horaires d'ouverture du bar
3. Un shift ne peut pas dépasser 8h maximum
4. Minimum 2 jours de repos par employé sur la semaine
5. shift_type: "matin" si shift finit avant 17h, "soir" si shift commence après 15h, "coupure" sinon
6. start_time et end_time au format "HH:MM:SS"
7. date au format "YYYY-MM-DD"
8. Copie les employee_id EXACTEMENT comme fournis ci-dessus
9. Pour les shifts qui finissent après minuit (ex: 03h), utilise "03:00:00" comme end_time
10. Réponds UNIQUEMENT avec du JSON valide, zéro texte, zéro backticks

SI LA DEMANDE EST UNE SUPPRESSION:
{"action":"delete","message":"résumé","date_from":"YYYY-MM-DD","date_to":"YYYY-MM-DD"}

SI LA DEMANDE EST UNE CRÉATION:
{"action":"create","message":"résumé","shifts":[{"employee_id":"ID_EXACT","date":"YYYY-MM-DD","shift_type":"matin","start_time":"HH:MM:SS","end_time":"HH:MM:SS"}]}

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
      await supabase.from('shifts')
        .delete()
        .eq('business_id', business_id)
        .in('employee_id', employees.map(e => e.id))
        .gte('date', parsed.date_from)
        .lte('date', parsed.date_to)
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
