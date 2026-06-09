import { createClient } from '../../../utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(request) {
  const { employee_id } = await request.json()

  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  await adminSupabase.from('shifts').delete().eq('employee_id', employee_id)
  await adminSupabase.from('profiles').delete().eq('id', employee_id)
  await adminSupabase.auth.admin.deleteUser(employee_id)

  return Response.json({ success: true })
}
