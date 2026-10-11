import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
const DEFAULT_EMPLOYEE_PASSWORD = 'PMS@2026'

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
    const { employee_id, email } = await request.json()
    if (typeof employee_id !== 'string' || typeof email !== 'string' || !email.includes('@')) return json({ error: 'Employee and email are required.' }, 400)
    const normalizedEmail = email.trim().toLowerCase()
    const { data: employee, error: employeeError } = await adminClient.from('pms_employees').select('id,first_name,last_name,email,auth_user_id').eq('id', employee_id).single()
    if (employeeError || !employee) return json({ error: 'Employee not found.' }, 404)
    if (employee.auth_user_id) return json({ error: 'This employee already has an Auth account.' }, 409)
    const { data: duplicateRows, error: duplicateError } = await adminClient.from('pms_employees').select('id').ilike('email', normalizedEmail).neq('id', employee_id).limit(1)
    if (duplicateError) return json({ error: 'Unable to verify the employee email.' }, 500)
    if (duplicateRows?.length) return json({ code: 'duplicate_email', error: 'This email is already assigned to another employee. Change the email before creating this portal account.' }, 409)
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({ email: normalizedEmail, password: DEFAULT_EMPLOYEE_PASSWORD, email_confirm: true, user_metadata: { full_name: `${employee.first_name} ${employee.last_name}`, must_change_password: true } })
    if (createError || !created.user) {
      if (/already registered|already exists|duplicate/i.test(createError?.message || '')) return json({ code: 'duplicate_email', error: 'This email already has a portal account. Change the email before creating this employee account.' }, 409)
      return json({ error: createError?.message || 'Unable to create the employee account.' }, 400)
    }
    const { error: employeeUpdateError } = await adminClient.from('pms_employees').update({ email: normalizedEmail, auth_user_id: created.user.id, must_change_password: true, password_changed_at: null }).eq('id', employee_id)
    const { error: roleError } = employeeUpdateError ? { error: employeeUpdateError } : await adminClient.from('pms_user_roles').upsert({ user_id: created.user.id, role: 'employee' })
    if (employeeUpdateError || roleError) {
      await adminClient.auth.admin.deleteUser(created.user.id)
      return json({ error: employeeUpdateError?.message || roleError?.message || 'Unable to complete account provisioning.' }, 500)
    }
    return json({ user_id: created.user.id, must_change_password: true })
  } catch {
    return json({ error: 'Unable to provision the employee account.' }, 500)
  }
})
