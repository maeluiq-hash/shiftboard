import { createClient } from '../../../utils/supabase/server'

export async function POST(request) {
  const supabase = await createClient()
  const { employee_id, date, shift_type, start_time, end_time } = await request.json()

  await supabase.from('shifts').delete().eq('employee_id', employee_id).eq('date', date)

  const { data, error } = await supabase.from('shifts').insert({
    employee_id,
    date,
    shift_type: shift_type === 'custom' ? 'coupure' : shift_type,
    start_time,
    end_time
  }).select().single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ shift: data })
}
