import { createClient } from '../../utils/supabase/server'
import { redirect } from 'next/navigation'
import AdminClient from './AdminClient'

export default async function AdminPage({ searchParams }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: businesses } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at')

  const params = await searchParams
  const activeBizId = params?.biz || businesses?.[0]?.id

  const { data: employees } = await supabase
    .from('profiles')
    .select('*, business_employees!inner(business_id)')
    .eq('business_employees.business_id', activeBizId)
    .order('full_name')

  const allEmployees = await supabase
    .from('profiles')
    .select('*')
    .order('full_name')

  const { data: shifts } = await supabase
    .from('shifts')
    .select('*, profiles(full_name)')
    .eq('business_id', activeBizId)
    .order('date')

  const pending = allEmployees.data?.filter(e => e.role === 'pending') || []

  return (
    <AdminClient
      profile={profile}
      employees={employees || []}
      allEmployees={allEmployees.data || []}
      shifts={shifts || []}
      pending={pending}
      businesses={businesses || []}
      activeBizId={activeBizId}
    />
  )
}
