import { createClient } from 'npm:@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, type PDFPage } from 'npm:pdf-lib@1.17.1'
import { drawFooter, drawReportHeader, drawTableHeader, drawTableRow, money, numberValue, rowHeight, type PdfColumn } from '../_shared/pdf-layout.ts'

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
      .select('employee_id,gross_pay,total_deductions,net_pay,employee_contributions,withholding_tax,employer_contributions,employee:pms_employees(employee_number,first_name,last_name),payroll_period_id')
      .in('payroll_period_id', periodIds)
      .order('employee_id')
    if (recordError) return json({ error: 'The finalized payroll records could not be loaded.' }, 500)

    const pdf = await PDFDocument.create()
    const font = await pdf.embedFont(StandardFonts.Helvetica)
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
    const columns: PdfColumn[] = [
      { label: 'Employee', width: 170 },
      { label: 'Period', width: 105 },
      { label: 'Gross pay', width: 95, align: 'right' },
      { label: 'Employee statutory / tax', width: 105, align: 'right' },
      { label: 'Other deductions', width: 90, align: 'right' },
      { label: 'Employer contributions', width: 90, align: 'right' },
      { label: 'Net pay', width: 77, align: 'right' },
    ]
    const rows = (records ?? []) as Array<Record<string, unknown>>
    let page: PDFPage
    let pageNumber = 0
    let y = 0
    const startPage = () => {
      page = pdf.addPage([792, 612])
      pageNumber += 1
      const periodLabel = requestedPeriod ? periods[0].name : `${periods.length} finalized periods`
      y = drawReportHeader(page, font, bold, 'Finalized payroll report', `${periodLabel} · ${rows.length} payroll records`, pageNumber, true)
      y = drawTableHeader(page, bold, columns, 30, y, 7.5)
    }
    startPage()
    let grossTotal = 0
    let statutoryTotal = 0
    let otherDeductionsTotal = 0
    let employerTotal = 0
    let netTotal = 0
    if (!rows.length) {
      y = drawTableRow(page, font, bold, columns, ['No finalized payroll records found', '', '', '', '', '', ''], 30, y, { size: 8 })
    }
    for (const record of rows) {
      const employee = record.employee as { employee_number?: string; first_name?: string; last_name?: string } | null
      const period = periods.find((item) => item.id === record.payroll_period_id)
      const gross = numberValue(record.gross_pay)
      const statutory = numberValue(record.employee_contributions) + numberValue(record.withholding_tax)
      const otherDeductions = Math.max(0, numberValue(record.total_deductions) - statutory)
      const employer = numberValue(record.employer_contributions)
      const net = numberValue(record.net_pay)
      grossTotal += gross
      statutoryTotal += statutory
      otherDeductionsTotal += otherDeductions
      employerTotal += employer
      netTotal += net
      const values = [
        `${employee?.employee_number ?? ''} ${employee?.last_name ?? ''}, ${employee?.first_name ?? ''}`,
        period?.name ?? 'Payroll period',
        money(gross),
        money(statutory),
        money(otherDeductions),
        money(employer),
        money(net),
      ]
      if (y - rowHeight(columns, values, font, 7.5) < 52) {
        drawFooter(page, font, 'Employee deductions include statutory contributions, withholding tax, loans, and other approved deductions.', true)
        startPage()
      }
      y = drawTableRow(page, font, bold, columns, values, 30, y, { size: 7.5 })
    }
    const totals = ['TOTAL', '', money(grossTotal), money(statutoryTotal), money(otherDeductionsTotal), money(employerTotal), money(netTotal)]
    if (y - rowHeight(columns, totals, font, 7.5) < 52) {
      drawFooter(page, font, 'Employee deductions include statutory contributions, withholding tax, loans, and other approved deductions.', true)
      startPage()
    }
    drawTableRow(page, font, bold, columns, totals, 30, y, { size: 7.5, fill: true, strong: true })
    drawFooter(page, font, 'Employee deductions include statutory contributions, withholding tax, loans, and other approved deductions.', true)
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
