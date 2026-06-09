import { createClient } from '../../utils/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: shifts } = await supabase
    .from('shifts')
    .select('*')
    .eq('employee_id', user.id)
    .order('date')

  return <DashboardClient profile={profile} shifts={shifts || []} />
}
