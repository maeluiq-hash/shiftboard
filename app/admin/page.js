import { createClient } from '../../utils/supabase/server'
import { redirect } from 'next/navigation'
import AdminClient from './AdminClient'

export default async function AdminPage(props) {
  const searchParams = await props.searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: businesses, error: bizError } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at')

  console.log('USER ID:', user.id)
  console.log('BUSINESSES:', businesses)
  console.log('BIZ ERROR:', bizError)

  const activeBizId = searchParams?.biz || businesses?.[0]?.id

  const { data: bizEmployees } = await supabase
    .from('business_employees')
    .select('employee_id')
    .eq('business_id', activeBizId)

  const employeeIds = bizEmployees?.map(e => e.employee_id) || []

  const { data: employees } = employeeIds.length > 0
    ? await supabase.from('profiles').select('*').in('id', employeeIds).order('full_name')
    : { data: [] }

  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('*')
    .order('full_name')

  const { data: shifts } = await supabase
    .from('shifts')
    .select('*, profiles(full_name)')
    .eq('business_id', activeBizId)
    .order('date')

  const pending = allProfiles?.filter(e => e.role === 'pending') || []

  return (
    <AdminClient
      profile={profile}
      employees={employees || []}
      allEmployees={allProfiles || []}
      shifts={shifts || []}
      pending={pending}
      businesses={businesses || []}
      activeBizId={activeBizId}
    />
  )
}
