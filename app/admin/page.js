import { createClient } from '../../utils/supabase/server'
import { redirect } from 'next/navigation'
import AdminClient from './AdminClient'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: employees } = await supabase
    .from('profiles')
    .select('*')
    .order('full_name')

  const { data: shifts } = await supabase
    .from('shifts')
    .select('*, profiles(full_name)')
    .order('date')

  const pending = employees?.filter(e => e.role === 'pending') || []

  return <AdminClient profile={profile} employees={employees || []} shifts={shifts || []} pending={pending} />
}
