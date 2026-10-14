import { createClient } from 'npm:@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
const text = (value: unknown) => String(value ?? '').replace(/[\r\n]+/g, ' ').trim()

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return json({ error: 'Authentication required.' }, 401)
    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const publicKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!
    const userClient = createClient(url, publicKey, { global: { headers: { Authorization: `Bearer ${token}` } } })
    const { data: caller, error: callerError } = await userClient.auth.getUser()
    if (callerError || !caller.user) return json({ error: 'Authentication required.' }, 401)
    const adminClient = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: role } = await adminClient.from('pms_user_roles').select('role').eq('user_id', caller.user.id).maybeSingle()
    if (role?.role !== 'admin') return json({ error: 'Administrator access is required.' }, 403)
    const [{ data: employees, error: employeeError }, { data: adminRoles, error: roleError }] = await Promise.all([
      adminClient.from('pms_employees').select('auth_user_id,employee_number,first_name,middle_name,last_name,email,status,department:pms_departments(name),position:pms_positions(name)').order('last_name'),
      adminClient.from('pms_user_roles').select('user_id').eq('role', 'admin'),
    ])
    if (employeeError || roleError) return json({ error: 'The employee directory could not be loaded.' }, 500)
    const adminIds = new Set((adminRoles ?? []).map((item) => item.user_id))
    const rows = (employees ?? []).filter((employee) => !employee.auth_user_id || !adminIds.has(employee.auth_user_id)) as Array<Record<string, unknown>>
    const pdf = await PDFDocument.create()
    const font = await pdf.embedFont(StandardFonts.Helvetica)
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
    for (let start = 0; start < Math.max(1, rows.length); start += 34) {
      const page = pdf.addPage([612, 792])
      const draw = (value: unknown, x: number, y: number, size = 9, strong = false) => page.drawText(text(value).slice(0, 86), { x, y, size, font: strong ? bold : font, color: rgb(0.08, 0.12, 0.2) })
      draw('LCC PAYROLL', 48, 742, 20, true); draw('Employee directory', 48, 716, 12, true); draw(`Page ${Math.floor(start / 34) + 1}`, 500, 742, 9)
      page.drawLine({ start: { x: 48, y: 694 }, end: { x: 564, y: 694 }, thickness: 1, color: rgb(0.75, 0.8, 0.85) })
      draw('Employee', 48, 675, 9, true); draw('Assignment', 250, 675, 9, true); draw('Contact', 400, 675, 9, true); draw('Status', 520, 675, 9, true)
      let y = 654
      for (const employee of rows.slice(start, start + 34)) {
        const department = employee.department as { name?: string } | null
        const position = employee.position as { name?: string } | null
        draw(`${employee.employee_number ?? ''} ${employee.last_name ?? ''}, ${employee.first_name ?? ''}`, 48, y)
        draw(`${position?.name ?? 'Unassigned'} / ${department?.name ?? 'No department'}`, 250, y)
        draw(employee.email ?? 'No email', 400, y)
        draw(employee.status ?? '', 520, y)
        y -= 19
      }
      draw('Administrator accounts are excluded from this directory export.', 48, 42, 8)
    }
    const bytes = await pdf.save()
    const storagePath = `directories/employees-${crypto.randomUUID()}.pdf`
    const { error: uploadError } = await adminClient.storage.from('pms-exports').upload(storagePath, bytes, { contentType: 'application/pdf', upsert: false })
    if (uploadError) return json({ error: 'The directory PDF could not be stored securely.' }, 500)
    const { data: signed, error: signedError } = await adminClient.storage.from('pms-exports').createSignedUrl(storagePath, 300)
    if (signedError || !signed?.signedUrl) return json({ error: 'The secure directory link could not be created.' }, 500)
    return json({ url: signed.signedUrl })
  } catch {
    return json({ error: 'Unable to generate the employee directory PDF.' }, 500)
  }
})
