import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return response({ error: 'Method not allowed' }, 405)
  try {
    const { employee_number, password } = await request.json()
    if (typeof employee_number !== 'string' || typeof password !== 'string' || employee_number.length < 3 || password.length < 1) {
      return response({ error: 'Employee number and password are required.' }, 400)
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const publicKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!
    const adminClient = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const authClient = createClient(supabaseUrl, publicKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: employee, error: employeeError } = await adminClient.from('pms_employees').select('auth_user_id,email,status,must_change_password').eq('employee_number', employee_number.trim()).maybeSingle()
    if (employeeError || !employee || employee.status !== 'active' || !employee.email || !employee.auth_user_id) return response({ error: 'Invalid credentials.' }, 401)
    const { data: authUser } = await adminClient.auth.admin.getUserById(employee.auth_user_id)
    if (!authUser.user?.email_confirmed_at) return response({ error: 'This account has not completed email verification.' }, 403)
    const { data, error } = await authClient.auth.signInWithPassword({ email: employee.email, password })
    if (error || !data.session) return response({ error: 'Invalid credentials.' }, 401)
    return response({ session: data.session, must_change_password: employee.must_change_password })
  } catch {
    return response({ error: 'Unable to process the sign-in request.' }, 500)
  }
})
