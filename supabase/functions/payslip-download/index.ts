import { createClient } from 'npm:@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, type PDFPage } from 'npm:pdf-lib@1.17.1'
import { drawFooter, drawLabelValue, drawReportHeader, drawTableHeader, drawTableRow, money, numberValue, PDF_COLORS, type PdfColumn } from '../_shared/pdf-layout.ts'

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
    const { payslip_id } = await request.json()
    if (typeof payslip_id !== 'string') return json({ error: 'Payslip is required.' }, 400)
    const { data: payslip, error: payslipError } = await adminClient.from('pms_employee_payslips').select('id,employee_id,payroll_record_id,storage_path,published_at').eq('id', payslip_id).single()
    if (payslipError || !payslip || !payslip.published_at) return json({ error: 'Payslip not found or not published.' }, 404)
    if (role?.role !== 'admin') {
      const { data: employee } = await adminClient.from('pms_employees').select('id').eq('id', payslip.employee_id).eq('auth_user_id', caller.user.id).maybeSingle()
      if (!employee) return json({ error: 'Payslip access denied.' }, 403)
    }
    let storagePath = payslip.storage_path as string | null
    if (!storagePath || !storagePath.startsWith('v2/')) {
      const { data: record } = await adminClient.from('pms_payroll_records').select('*, employee:pms_employees(employee_number,first_name,last_name), period:pms_payroll_periods(name,start_date,end_date,pay_date)').eq('id', payslip.payroll_record_id).single()
      if (!record) return json({ error: 'Payroll record not found.' }, 404)
      const pdf = await PDFDocument.create()
      const page: PDFPage = pdf.addPage([612, 792])
      const font = await pdf.embedFont(StandardFonts.Helvetica)
      const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
      const snapshot = (record.calculation_snapshot ?? {}) as Record<string, unknown>
      const attendance = (snapshot.attendance ?? {}) as Record<string, unknown>
      const statutory = (snapshot.statutory ?? {}) as Record<string, unknown>
      const sss = (statutory.sss ?? {}) as Record<string, unknown>
      const philhealth = (statutory.philhealth ?? {}) as Record<string, unknown>
      const pagibig = (statutory.pagibig ?? {}) as Record<string, unknown>
      const columns: PdfColumn[] = [
        { label: 'Payroll component', width: 385 },
        { label: 'Amount', width: 143, align: 'right' },
      ]
      const employeeName = `${record.employee?.first_name ?? ''} ${record.employee?.last_name ?? ''}`.trim() || 'Employee'
      let y = drawReportHeader(page, font, bold, 'Employee payslip', `${record.period?.name ?? 'Payroll period'} · Pay date ${record.period?.pay_date ?? 'Not set'}`, 1)
      page.drawRectangle({ x: 42, y: y - 66, width: 528, height: 66, color: PDF_COLORS.soft, borderColor: PDF_COLORS.border, borderWidth: 0.6 })
      drawLabelValue(page, font, bold, 'Employee', employeeName, 56, y - 16, 230)
      drawLabelValue(page, font, bold, 'Employee number', record.employee?.employee_number ?? '', 310, y - 16, 110)
      drawLabelValue(page, font, bold, 'Payroll period', record.period?.name ?? 'Payroll period', 430, y - 16, 120)
      drawLabelValue(page, font, bold, 'Pay date', record.period?.pay_date ?? 'Not set', 56, y - 47, 180)
      drawLabelValue(page, font, bold, 'Status', 'Published', 310, y - 47, 110)
      y -= 84

      const drawSection = (label: string) => {
        page.drawText(label, { x: 42, y, size: 9, font: bold, color: PDF_COLORS.primary })
        y -= 14
        y = drawTableHeader(page, bold, columns, 42, y, 8)
      }
      const drawRows = (rows: Array<[string, unknown]>) => {
        rows.forEach(([label, amount]) => {
          const values = [label, money(amount)]
          y = drawTableRow(page, font, bold, columns, values, 42, y, { size: 8, strong: label === 'Gross pay' || label === 'Total deductions' })
        })
      }

      drawSection('EARNINGS')
      drawRows([
        ['Base pay', record.base_pay ?? record.basic_pay],
        ['Attendance deductions', -numberValue(record.attendance_deductions)],
        ['Basic pay after attendance', record.basic_pay],
        ['Overtime pay', record.overtime_pay],
        ['Other income', record.other_income],
        ['Gross pay', record.gross_pay],
      ])

      y -= 14
      drawSection('EMPLOYEE DEDUCTIONS')
      const contributionRows: Array<[string, unknown]> = [
        ['SSS employee contribution', -numberValue(sss.employee)],
        ['PhilHealth employee contribution', -numberValue(philhealth.employee)],
        ['Pag-IBIG employee contribution', -numberValue(pagibig.employee)],
        ['Withholding tax', -numberValue(record.withholding_tax)],
        ['Loan deductions', -numberValue(record.loan_deductions)],
        ['Other deductions', -numberValue(record.other_deductions)],
      ]
      if (numberValue(contributionRows[0][1]) + numberValue(contributionRows[1][1]) + numberValue(contributionRows[2][1]) === 0 && numberValue(record.employee_contributions) > 0) {
        contributionRows.splice(0, 3, ['Employee statutory contributions', -numberValue(record.employee_contributions)])
      }
      drawRows(contributionRows)
      drawRows([['Total deductions', -numberValue(record.total_deductions)]])

      y -= 14
      page.drawRectangle({ x: 42, y: y - 76, width: 528, height: 76, color: PDF_COLORS.soft, borderColor: PDF_COLORS.border, borderWidth: 0.6 })
      drawLabelValue(page, font, bold, 'Net pay', money(record.net_pay), 56, y - 17, 160)
      drawLabelValue(page, font, bold, 'Employer contributions', money(record.employer_contributions), 230, y - 17, 170)
      drawLabelValue(page, font, bold, 'Days worked', attendance.days_worked ?? '', 420, y - 17, 120)
      drawLabelValue(page, font, bold, 'Absences', attendance.absence_days ?? '', 56, y - 50, 160)
      drawLabelValue(page, font, bold, 'Tardiness', `${attendance.tardiness_minutes ?? 0} minutes`, 230, y - 50, 170)
      drawLabelValue(page, font, bold, 'Overtime', `${attendance.overtime_hours ?? 0} hours`, 420, y - 50, 120)
      drawFooter(page, font, 'Private payroll document. Statutory and tax amounts use the approved payroll schedules.')
      const bytes = await pdf.save()
      storagePath = `v2/${record.employee?.employee_number ?? payslip.employee_id}/${payslip.id}.pdf`
      const { error: uploadError } = await adminClient.storage.from('pms-payslips').upload(storagePath, bytes, { contentType: 'application/pdf', upsert: true })
      if (uploadError) return json({ error: uploadError.message }, 500)
      await adminClient.from('pms_employee_payslips').update({ storage_path: storagePath }).eq('id', payslip.id)
    }
    const { data: signed, error: signedError } = await adminClient.storage.from('pms-payslips').createSignedUrl(storagePath, 300)
    if (signedError || !signed?.signedUrl) return json({ error: signedError?.message || 'Unable to create a secure download link.' }, 500)
    return json({ url: signed.signedUrl })
  } catch {
    return json({ error: 'Unable to generate the payslip.' }, 500)
  }
})
