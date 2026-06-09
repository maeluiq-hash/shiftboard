import { createClient } from '../../../utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

  const { email, password, full_name, business_id } = await request.json()

  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { data: newUser, error: authError } = await adminSupabase.auth.admin.createUser({
    email, password, email_confirm: true
  })

  if (authError) return Response.json({ error: authError.message }, { status: 400 })

  const { error: profileError } = await adminSupabase.from('profiles').insert({
    id: newUser.user.id, email, full_name, role: 'employee'
  })

  if (profileError) return Response.json({ error: profileError.message }, { status: 400 })

  if (business_id) {
    await adminSupabase.from('business_employees').insert({
      business_id, employee_id: newUser.user.id
    })
  }

  return Response.json({ success: true })
}
