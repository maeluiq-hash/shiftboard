import { createClient } from '../../../utils/supabase/server'

export async function POST(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

    const { message, employees } = await request.json()
    const employeeList = employees.map(e => `${e.full_name} (id: ${e.id})`).join(', ')

    const { data: settingsData } = await supabase.from('settings').select('*')
    const settings = {}
    settingsData?.forEach(row => { settings[row.key] = row.value })

    const businessContext = settings.business_context || ''
    const openingHours = settings.opening_hours || ''

    const prompt = `Tu es un assistant de planification pour un restaurant/bar.
Tu dois générer des horaires de travail en JSON.
Employés disponibles: ${employeeList}
${openingHours ? `Horaires d'ouverture du bar:\n${openingHours}` : ''}
${businessContext ? `Informations sur l'établissement:\n${businessContext}` : ''}
Règles:
- shift_type: "matin", "soir", ou "coupure"
- start_time et end_time au format "HH:MM:SS"
- date au format "YYYY-MM-DD"
- Utilise exactement les IDs fournis pour employee_id
- Adapte les shifts aux horaires d'ouverture si fournis
- Réponds UNIQUEMENT avec un JSON valide, sans texte avant ou après, sans backticks

Format exact:
{"message":"explication courte","shifts":[{"employee_id":"uuid-ici","date":"2026-06-09","shift_type":"matin","start_time":"07:00:00","end_time":"15:00:00"}]}

Demande: ${message}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
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
    if (!jsonMatch) return Response.json({ error: 'Réponse IA invalide' }, { status: 500 })

    const parsed = JSON.parse(jsonMatch[0])

    await supabase.from('shifts').delete().in('employee_id', employees.map(e => e.id))
      .gte('date', parsed.shifts[0]?.date || '2026-01-01')
      .lte('date', parsed.shifts[parsed.shifts.length-1]?.date || '2099-01-01')

    const { error: insertError } = await supabase.from('shifts').insert(
      parsed.shifts.map(s => ({
        employee_id: s.employee_id,
        date: s.date,
        shift_type: s.shift_type,
        start_time: s.start_time,
        end_time: s.end_time
      }))
    )

    if (insertError) return Response.json({ error: insertError.message }, { status: 500 })

    return Response.json({ success: true, message: parsed.message, count: parsed.shifts.length })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
