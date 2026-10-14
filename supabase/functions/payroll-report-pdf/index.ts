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

    const body = await request.json().catch(() => ({})) as { period_id?: unknown }
    const requestedPeriod = typeof body.period_id === 'string' && body.period_id ? body.period_id : null
    let periodsQuery = adminClient.from('pms_payroll_periods').select('id,name,start_date,end_date,pay_date,status').in('status', ['finalized', 'paid']).order('start_date', { ascending: false })
    if (requestedPeriod) periodsQuery = periodsQuery.eq('id', requestedPeriod)
    const { data: periods, error: periodError } = await periodsQuery
    if (periodError) return json({ error: 'The finalized payroll periods could not be loaded.' }, 500)
    if (!periods?.length) return json({ error: 'No finalized payroll records are available for this export.' }, 404)
    const periodIds = periods.map((period) => period.id)
    const { data: records, error: recordError } = await adminClient
      .from('pms_payroll_records')
      .select('employee_id,gross_pay,total_deductions,net_pay,employee:pms_employees(employee_number,first_name,last_name),payroll_period_id')
      .in('payroll_period_id', periodIds)
      .order('employee_id')
    if (recordError) return json({ error: 'The finalized payroll records could not be loaded.' }, 500)

    const pdf = await PDFDocument.create()
    const font = await pdf.embedFont(StandardFonts.Helvetica)
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
    const drawPage = (pageRecords: Array<Record<string, unknown>>, pageNumber: number) => {
      const page = pdf.addPage([612, 792])
      const draw = (value: unknown, x: number, y: number, size = 10, strong = false) => page.drawText(text(value).slice(0, 82), { x, y, size, font: strong ? bold : font, color: rgb(0.08, 0.12, 0.2) })
      draw('LCC PAYROLL', 48, 742, 20, true)
      draw(requestedPeriod ? `Finalized payroll report: ${periods[0].name}` : 'Finalized payroll report', 48, 716, 12, true)
      draw(`Page ${pageNumber}`, 500, 742, 9)
      page.drawLine({ start: { x: 48, y: 694 }, end: { x: 564, y: 694 }, thickness: 1, color: rgb(0.75, 0.8, 0.85) })
      draw('Employee', 48, 675, 9, true); draw('Period', 220, 675, 9, true); draw('Gross', 362, 675, 9, true); draw('Deductions', 430, 675, 9, true); draw('Net pay', 510, 675, 9, true)
      let y = 654
      for (const record of pageRecords) {
        const employee = record.employee as { employee_number?: string; first_name?: string; last_name?: string } | null
        const period = periods.find((item) => item.id === record.payroll_period_id)
        draw(`${employee?.employee_number ?? ''} ${employee?.last_name ?? ''}, ${employee?.first_name ?? ''}`, 48, y)
        draw(period?.name ?? '', 220, y)
        draw(`PHP ${Number(record.gross_pay ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, 362, y)
        draw(`PHP ${Number(record.total_deductions ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, 430, y)
        draw(`PHP ${Number(record.net_pay ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, 510, y, 10, true)
        y -= 20
      }
      draw('Generated from finalized payroll records. Statutory and tax amounts use the approved payroll schedules.', 48, 42, 8)
    }
    const rows = (records ?? []) as Array<Record<string, unknown>>
    for (let index = 0; index < Math.max(1, rows.length); index += 29) drawPage(rows.slice(index, index + 29), Math.floor(index / 29) + 1)
    const bytes = await pdf.save()
    const storagePath = `reports/payroll-${crypto.randomUUID()}.pdf`
    const { error: uploadError } = await adminClient.storage.from('pms-exports').upload(storagePath, bytes, { contentType: 'application/pdf', upsert: false })
    if (uploadError) return json({ error: 'The report PDF could not be stored securely.' }, 500)
    const { data: signed, error: signedError } = await adminClient.storage.from('pms-exports').createSignedUrl(storagePath, 300)
    if (signedError || !signed?.signedUrl) return json({ error: 'The secure report link could not be created.' }, 500)
    return json({ url: signed.signedUrl })
  } catch {
    return json({ error: 'Unable to generate the payroll report PDF.' }, 500)
  }
})
