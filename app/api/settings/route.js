import { createClient } from '../../../utils/supabase/server'

export async function GET(request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const biz = searchParams.get('biz') || 'default'

  const { data } = await supabase.from('settings').select('*')
  const settings = {}
  data?.forEach(row => { settings[row.key] = row.value })

  return Response.json({
    opening_hours: settings[`opening_hours_${biz}`] || settings['opening_hours'] || '',
    business_context: settings[`business_context_${biz}`] || settings['business_context'] || ''
  })
}

export async function POST(request) {
  const supabase = await createClient()
  const body = await request.json()
  const biz = body.biz || 'default'

  await supabase.from('settings').upsert({ key: `opening_hours_${biz}`, value: body.opening_hours || '' }, { onConflict: 'key' })
  await supabase.from('settings').upsert({ key: `business_context_${biz}`, value: body.business_context || '' }, { onConflict: 'key' })

  return Response.json({ success: true })
}
