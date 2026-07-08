import { createClient } from '../../../utils/supabase/server'

export async function GET() {
  const supabase = await createClient()
  await supabase.from('settings').select('id').limit(1)
  return Response.json({ ok: true, timestamp: new Date().toISOString() })
}
