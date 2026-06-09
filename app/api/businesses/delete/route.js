import { createClient } from '../../../../utils/supabase/server'

export async function POST(request) {
  const supabase = await createClient()
  const { business_id } = await request.json()
  await supabase.from('businesses').delete().eq('id', business_id)
  return Response.json({ success: true })
}
