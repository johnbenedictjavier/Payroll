import { createClient } from 'npm:@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, type PDFPage } from 'npm:pdf-lib@1.17.1'
import { drawFooter, drawReportHeader, drawTableHeader, drawTableRow, rowHeight, type PdfColumn } from '../_shared/pdf-layout.ts'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

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
    const columns: PdfColumn[] = [
      { label: 'Employee', width: 190 },
      { label: 'Assignment', width: 158 },
      { label: 'Contact', width: 120 },
      { label: 'Status', width: 58, align: 'center' },
    ]
    let page: PDFPage
    let pageNumber = 0
    let y = 0
    const startPage = () => {
      page = pdf.addPage([612, 792])
      pageNumber += 1
      y = drawReportHeader(page, font, bold, 'Employee directory', `${rows.length} employees · Generated ${new Date().toLocaleString('en-PH')}`, pageNumber)
      y = drawTableHeader(page, bold, columns, 42, y)
    }
    startPage()
    if (!rows.length) {
      y = drawTableRow(page, font, bold, columns, ['No employees found', '', '', ''], 42, y, { size: 8 })
    }
    for (const employee of rows) {
      const department = employee.department as { name?: string } | null
      const position = employee.position as { name?: string } | null
      const values = [
        `${employee.employee_number ?? ''} ${employee.last_name ?? ''}, ${employee.first_name ?? ''}`,
        `${position?.name ?? 'Unassigned'} / ${department?.name ?? 'No department'}`,
        employee.email ?? 'No email',
        employee.status ?? '',
      ]
      if (y - rowHeight(columns, values, font, 8) < 52) {
        drawFooter(page, font, 'Administrator accounts are excluded from this directory export.')
        startPage()
      }
      y = drawTableRow(page, font, bold, columns, values, 42, y, { size: 8 })
    }
    drawFooter(page, font, 'Administrator accounts are excluded from this directory export.')
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
