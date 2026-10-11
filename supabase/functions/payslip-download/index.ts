import { createClient } from 'npm:@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1'

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
    if (!storagePath) {
      const { data: record } = await adminClient.from('pms_payroll_records').select('*, employee:pms_employees(employee_number,first_name,last_name), period:pms_payroll_periods(name,start_date,end_date,pay_date)').eq('id', payslip.payroll_record_id).single()
      if (!record) return json({ error: 'Payroll record not found.' }, 404)
      const pdf = await PDFDocument.create()
      const page = pdf.addPage([612, 792])
      const font = await pdf.embedFont(StandardFonts.Helvetica)
      const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
      const draw = (text: string, x: number, y: number, size = 11, isBold = false) => page.drawText(text, { x, y, size, font: isBold ? bold : font, color: rgb(0.08, 0.12, 0.2) })
      draw('LCC PAYROLL', 54, 724, 22, true); draw('Employee Payslip', 54, 696, 13); draw(String(record.period?.name ?? 'Payroll period'), 54, 672, 11); draw(`Pay date: ${record.period?.pay_date ?? 'Not set'}`, 54, 653, 10)
      draw(`Employee: ${record.employee?.first_name ?? ''} ${record.employee?.last_name ?? ''}`, 54, 615, 11, true); draw(`Employee number: ${record.employee?.employee_number ?? ''}`, 54, 596, 10)
      page.drawLine({ start: { x: 54, y: 570 }, end: { x: 558, y: 570 }, thickness: 1, color: rgb(0.75, 0.8, 0.85) })
      const rows = [['Basic pay', record.basic_pay], ['Overtime pay', record.overtime_pay], ['Other income', record.other_income], ['Employee contributions', -record.employee_contributions], ['Withholding tax', -record.withholding_tax], ['Loan deductions', -record.loan_deductions], ['Other deductions', -record.other_deductions], ['Gross pay', record.gross_pay], ['Total deductions', -record.total_deductions], ['NET PAY', record.net_pay]] as Array<[string, number]>
      rows.forEach(([label, amount], index) => { const y = 535 - index * 27; draw(label, 60, y, label === 'NET PAY' ? 13 : 10, label === 'NET PAY' || label === 'Gross pay'); draw(`PHP ${Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, 405, y, label === 'NET PAY' ? 13 : 10, label === 'NET PAY' || label === 'Gross pay') })
      draw('Generated from finalized payroll records. Keep this document private.', 54, 72, 9)
      const bytes = await pdf.save()
      storagePath = `pms-payslips/${record.employee?.employee_number ?? payslip.employee_id}/${payslip.id}.pdf`
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
