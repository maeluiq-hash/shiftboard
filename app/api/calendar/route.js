import { createClient } from '../../../utils/supabase/server'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const employeeId = searchParams.get('employee_id')
  const token = searchParams.get('token')

  const supabase = await createClient()

  let query = supabase.from('shifts').select('*, profiles(full_name)').order('date')
  if (employeeId) query = query.eq('employee_id', employeeId)

  const { data: shifts } = await query

  const events = shifts?.map(shift => {
    const name = shift.profiles?.full_name || 'Employé'
    const dateStr = shift.date.replace(/-/g, '')
    const startStr = shift.start_time.replace(/:/g, '').slice(0, 6)
    const endStr = shift.end_time.replace(/:/g, '').slice(0, 6)
    const uid = `shift-${shift.id}@shiftboard`

    return [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART:${dateStr}T${startStr}`,
      `DTEND:${dateStr}T${endStr}`,
      `SUMMARY:Shift ${name}`,
      `DESCRIPTION:${shift.start_time.slice(0,5)} - ${shift.end_time.slice(0,5)}`,
      'END:VEVENT'
    ].join('\r\n')
  }).join('\r\n')

  const ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ShiftBoard//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:ShiftBoard',
    'X-WR-TIMEZONE:Europe/Paris',
    events || '',
    'END:VCALENDAR'
  ].join('\r\n')

  return new Response(ical, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="shiftboard.ics"',
      'Cache-Control': 'no-cache',
    }
  })
}
