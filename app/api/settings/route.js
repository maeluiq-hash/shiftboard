import { createClient } from '../../../utils/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data } = await supabase.from('settings').select('*')
  const settings = {}
  data?.forEach(row => { settings[row.key] = row.value })
  return Response.json(settings)
}

export async function POST(request) {
  const supabase = await createClient()
  const body = await request.json()
  
  for (const [key, value] of Object.entries(body)) {
    await supabase.from('settings').upsert({ key, value }, { onConflict: 'key' })
  }
  
  return Response.json({ success: true })
}
