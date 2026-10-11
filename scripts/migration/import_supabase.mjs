import fs from 'node:fs/promises'
import process from 'node:process'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const sourcePath = process.argv[2] || 'migration-output/live-source.json'
const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceRoleKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for the trusted importer.')

const source = JSON.parse(await fs.readFile(sourcePath, 'utf8'))
const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
const idMaps = { departments: new Map(), positions: new Map(), employees: new Map(), assignments: new Map() }
const report = { source: source.source, imported: {}, warnings: [...(source.warnings || [])], errors: [] }

async function upsert(table, rows, onConflict) {
  if (!rows.length) return []
  const { data, error } = await supabase.from(table).upsert(rows, { onConflict, ignoreDuplicates: false }).select()
  if (error) throw new Error(`${table}: ${error.message}`)
  report.imported[table] = data.length
  return data
}

async function update(table, values, column, value) {
  const { error } = await supabase.from(table).update(values).eq(column, value)
  if (error) throw new Error(`${table}: ${error.message}`)
}

try {
  const departments = await upsert('pms_departments', (source.tables.department || []).map((row) => ({ legacy_department_id: row.dept_id, name: row.dept_name.trim().toUpperCase() })), 'legacy_department_id')
  departments.forEach((row) => idMaps.departments.set(row.legacy_department_id, row.id))
  const positions = await upsert('pms_positions', (source.tables.position || []).map((row) => ({ legacy_position_id: row.pos_id, name: row.pos_name.trim().toUpperCase() })), 'legacy_position_id')
  positions.forEach((row) => idMaps.positions.set(row.legacy_position_id, row.id))
  const employees = await upsert('pms_employees', (source.tables.employee_info || []).map((row) => ({
    legacy_employee_id: row.employee_id, employee_number: row.employee_num, first_name: row.fn || 'Unknown', middle_name: row.mn || null, last_name: row.ln || 'Unknown', gender: row.gender || null, email: row.email || null, civil_status: row.civil || null, nationality: row.nationality || null, religion: row.religion || null, birth_date: row.bdate || null, permanent_address: row.perm_add || null, present_address: row.pres_add || null, contact_number: row.contact || null, legacy_photo_path: row.photo || null,
  })), 'legacy_employee_id')
  employees.forEach((row) => idMaps.employees.set(row.employee_number, row.id))
  const positionsByName = new Map(positions.map((row) => [row.name, row.id]))
  const departmentsByName = new Map(departments.map((row) => [row.name, row.id]))
  const assignments = await upsert('pms_employee_assignments', (source.tables.employee_position || []).map((row) => ({ legacy_assignment_id: row.id, employee_id: idMaps.employees.get(row.employee_num), department_id: departmentsByName.get((row.department || '').trim().toUpperCase()) || null, position_id: positionsByName.get((row.position || '').trim().toUpperCase()) || null, start_date: row.start_date || '1900-01-01', end_date: row.end_date || null })), 'legacy_assignment_id')
  assignments.forEach((row) => idMaps.assignments.set(row.legacy_assignment_id, row.id))
  const assignmentsByEmployee = new Map()
  for (const sourceAssignment of source.tables.employee_position || []) {
    const existing = assignmentsByEmployee.get(sourceAssignment.employee_num) || []
    existing.push(sourceAssignment)
    assignmentsByEmployee.set(sourceAssignment.employee_num, existing)
  }
  for (const [employeeNumber, employeeAssignments] of assignmentsByEmployee) {
    const employeeId = idMaps.employees.get(employeeNumber)
    if (!employeeId) continue
    if (employeeAssignments.length !== 1) {
      report.warnings.push({ type: 'multiple_assignments', employee_number: employeeNumber, assignment_ids: employeeAssignments.map((row) => row.id), message: 'Current department and position require administrator review.' })
      continue
    }
    const sourceAssignment = employeeAssignments[0]
    await update('pms_employees', { current_department_id: departmentsByName.get((sourceAssignment.department || '').trim().toUpperCase()) || null, current_position_id: positionsByName.get((sourceAssignment.position || '').trim().toUpperCase()) || null }, 'id', employeeId)
  }
  await upsert('pms_employee_salary_history', (source.tables.employee_position || []).map((row) => ({ legacy_salary_id: row.id, employee_id: idMaps.employees.get(row.employee_num), assignment_id: idMaps.assignments.get(row.id), salary_type: 'monthly', amount: Number(row.monthly || 0), legacy_daily_amount: row.daily === null ? null : Number(row.daily), legacy_hourly_amount: row.hourly === null ? null : Number(row.hourly), is_approved: false, effective_from: row.start_date || '1900-01-01', effective_to: row.end_date || null, source: 'legacy employee_position; review required' })), 'legacy_salary_id')
  await upsert('pms_emergency_contacts', (source.tables.e_contact || []).map((row) => ({ legacy_id: row.id, employee_id: idMaps.employees.get(row.employee_num), name: row.name || 'Unknown', relationship: row.relationship || null, address: row.address || null, contact: row.contact || null })), 'legacy_id')
  await upsert('pms_dependents', (source.tables.dependent || []).map((row) => ({ legacy_id: row.id, employee_id: idMaps.employees.get(row.employee_num), name: row.name || 'Unknown', birth_date: row.bdate || null, relationship: row.relationship || null })), 'legacy_id')
  await upsert('pms_educational_backgrounds', (source.tables.educ_bg || []).map((row) => ({ legacy_id: row.id, employee_id: idMaps.employees.get(row.employee_num), level: row.level || null, school: row.school || null, address: row.address || null, school_year: row.sy || null })), 'legacy_id')
  await upsert('pms_character_references', (source.tables.charac_ref || []).map((row) => ({ legacy_id: row.id, employee_id: idMaps.employees.get(row.employee_num), name: row.name || 'Unknown', occupation: row.occupation || null, address: row.address || null, contact: row.contact || null })), 'legacy_id')
  await upsert('pms_employee_identifiers', (source.tables.valid_id || []).map((row) => ({ legacy_id: row.id, employee_id: idMaps.employees.get(row.employee_num), identifier_type: row.type || 'other', identifier_value: row.id_info || '' })), 'legacy_id')
  const legacyRoot = process.env.LEGACY_ROOT || process.cwd()
  for (const sourceEmployee of source.tables.employee_info || []) {
    const employeeId = idMaps.employees.get(sourceEmployee.employee_num)
    if (!employeeId || !sourceEmployee.photo) continue
    const localPath = path.resolve(legacyRoot, sourceEmployee.photo)
    try {
      const file = await fs.readFile(localPath)
      const extension = path.extname(localPath).toLowerCase() || '.jpg'
      const storagePath = `${employeeId}/profile${extension}`
      const { error } = await supabase.storage.from('pms-employee-avatars').upload(storagePath, file, { contentType: extension === '.png' ? 'image/png' : 'image/jpeg', upsert: true })
      if (error) report.warnings.push({ type: 'photo_upload_failed', employee_number: sourceEmployee.employee_num, message: error.message })
      else await update('pms_employees', { photo_path: storagePath }, 'id', employeeId)
    } catch {
      report.warnings.push({ type: 'photo_missing', employee_number: sourceEmployee.employee_num, path: sourceEmployee.photo })
    }
  }
  for (const user of source.users || []) report.warnings.push({ type: 'auth_provisioning_required', employee_number: user.employee_num, role: user.role, message: 'Create an invited Supabase Auth account, verify a unique email, and reset credentials.' })
  await fs.mkdir('migration-output', { recursive: true })
  await fs.writeFile('migration-output/import-report.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} catch (error) {
  report.errors.push(String(error))
  await fs.mkdir('migration-output', { recursive: true })
  await fs.writeFile('migration-output/import-report.json', JSON.stringify(report, null, 2))
  console.error(JSON.stringify(report, null, 2))
  process.exitCode = 1
}
