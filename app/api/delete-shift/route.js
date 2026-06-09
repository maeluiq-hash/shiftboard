import { createClient } from '../../../utils/supabase/server'

export async function POST(request) {
  const supabase = await createClient()
  const { employee_id, date } = await request.json()
  await supabase.from('shifts').delete().eq('employee_id', employee_id).eq('date', date)
  return Response.json({ success: true })
}
