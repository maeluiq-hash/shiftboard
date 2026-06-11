import { createClient } from '../../../utils/supabase/server'

export async function POST(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorise' }, { status: 401 })
  const { employee_id, business_id, action } = await request.json()
  if (action === 'add') {
    const { error } = await supabase.from('business_employees').upsert({ business_id, employee_id }, { onConflict: 'business_id,employee_id' })
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true })
  }
  if (action === 'remove') {
    const { error } = await supabase.from('business_employees').delete().eq('business_id', business_id).eq('employee_id', employee_id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true })
  }
  return Response.json({ error: 'Action invalide' }, { status: 400 })
}
