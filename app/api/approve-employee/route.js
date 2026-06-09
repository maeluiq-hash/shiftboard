import { createClient } from '../../../utils/supabase/server'

export async function POST(request) {
  const supabase = await createClient()
  const { employee_id } = await request.json()

  const { error } = await supabase
    .from('profiles')
    .update({ role: 'employee' })
    .eq('id', employee_id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
