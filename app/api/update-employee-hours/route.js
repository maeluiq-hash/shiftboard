import { createClient } from '../../../utils/supabase/server'

export async function POST(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

  const { employee_id, min_hours, max_hours } = await request.json()

  const { error } = await supabase
    .from('profiles')
    .update({
      min_hours: min_hours ? parseInt(min_hours) : null,
      max_hours: max_hours ? parseInt(max_hours) : null
    })
    .eq('id', employee_id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
