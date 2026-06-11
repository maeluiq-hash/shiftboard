import { createClient } from '../../utils/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export default async function DashboardPage(props) {
  const searchParams = await props.searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'admin') redirect('/admin')
  if (profile?.role === 'pending') redirect('/pending')

  // Établissements de l'employé
  const { data: myBizLinks } = await supabase
    .from('business_employees')
    .select('business_id')
    .eq('employee_id', user.id)

  const myBizIds = myBizLinks?.map(b => b.business_id) || []

  const { data: myBusinesses } = myBizIds.length > 0
    ? await supabase.from('businesses').select('*').in('id', myBizIds)
    : { data: [] }

  const activeBizId = searchParams?.biz || myBizIds[0]

  const { data: shifts } = activeBizId ? await supabase
    .from('shifts')
    .select('*')
    .eq('employee_id', user.id)
    .eq('business_id', activeBizId)
    .order('date') : { data: [] }

  const { data: allShifts } = activeBizId ? await supabase
    .from('shifts')
    .select('*')
    .eq('business_id', activeBizId)
    .order('date') : { data: [] }

  const { data: bizEmployeeLinks } = activeBizId ? await supabase
    .from('business_employees')
    .select('employee_id')
    .eq('business_id', activeBizId) : { data: [] }

  const empIds = bizEmployeeLinks?.map(e => e.employee_id) || []
  const { data: employees } = empIds.length > 0
    ? await supabase.from('profiles').select('*').in('id', empIds)
    : { data: [] }

  return (
    <DashboardClient
      profile={profile}
      shifts={shifts || []}
      allShifts={allShifts || []}
      employees={employees || []}
      myBusinesses={myBusinesses || []}
      activeBizId={activeBizId}
    />
  )
}
