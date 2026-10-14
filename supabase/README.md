# Supabase Operations

## Apply migrations

Apply the migrations in order to the selected Supabase project using the Supabase CLI or SQL editor. `202610110001_initial_schema.sql` creates the canonical schema, RLS policies, private Storage buckets, audit triggers, payroll functions, and payslip publication workflow. `202610110002_employee_management.sql` adds full employee-profile saving, automatic employee numbers, private DOCX retention, and first-login password controls. `202610110003_employee_number_rules.sql` makes employee numbers immutable after creation. `202610110004_repair_updated_at_columns.sql` repairs pre-existing PMS tables so profile updates can run their timestamp triggers safely. `202610130001_fix_preview_payroll_ambiguous_columns.sql` qualifies payroll preview source columns so finalization is not blocked by ambiguous output names. `202610140001_remove_payroll_configuration.sql` replaces configurable payroll inputs with fixed defaults and retires the old policy and statutory tables as protected legacy archives. `202610150001_feature_guards.sql` adds server-side validation and locked-period guards. `202610150002_secure_exports.sql` creates the private export bucket. `202610150003_statutory_reference_repair.sql` creates the resilient informational statutory reference register and repairs the status RPC. `202610150004_salary_configuration_crud.sql` adds validated salary create/edit/delete operations and protects every salary row referenced by a payroll snapshot.

The shared Supabase project has unrelated pre-existing student-system migration history. Those migrations are intentionally not included in this Payroll application's `supabase/migrations/` directory and are not referenced by Payroll. Do not remove the existing remote student objects unless the student system is being retired.

Because those remote history entries are intentionally absent locally, a future CLI `db push` may require temporarily running `supabase migration fetch`, applying the PMS migration, and then deleting the fetched LQ files again. Never mark the remote LQ migrations as reverted.

## Operational setup before payroll

1. Create or import administrator Auth accounts with verified email addresses.
2. Insert matching `pms_user_roles` rows with the `admin` role using a trusted operation.
3. Review imported employees, emails, assignments, salaries, and profile images.
4. Optionally record the four informational statutory references from the administrator's `Statutory references` page. These records document sources only and do not activate statutory or tax deductions.

Payroll uses 26 work days per period, 8 hours per day, and a 1.25 overtime multiplier. Monthly salaries deduct absence, tardiness, and undertime; daily and hourly salaries use days worked. Statutory contributions and withholding tax are not deducted.

Active employee loans with administrator priority are included as authorized deductions. Preview estimates the installment; finalization records the repayment and reduces the outstanding balance exactly once. Marking payroll paid or publishing payslips does not apply another loan repayment.

## Bootstrap the first administrator

Create a verified user in Supabase Dashboard > Authentication > Users first, then run the following in the SQL Editor after replacing the email and name values:

```sql
do $$
declare
  admin_email text := lower('admin@example.com');
  admin_user_id uuid;
begin
  select id into admin_user_id from auth.users where lower(email) = admin_email limit 1;
  if admin_user_id is null then
    raise exception 'Create and verify the Auth user before running this block';
  end if;

  insert into public.pms_employees (
    auth_user_id, employee_number, first_name, last_name, email,
    status, must_change_password, password_changed_at
  ) values (
    admin_user_id, 'ADMIN-0001', 'Payroll', 'Administrator', admin_email,
    'active', false, now()
  )
  on conflict (auth_user_id) do update set
    email = excluded.email,
    status = excluded.status,
    must_change_password = false,
    password_changed_at = now();

  insert into public.pms_user_roles (user_id, role)
  values (admin_user_id, 'admin')
  on conflict (user_id) do update set role = 'admin';
end $$;
```

## Edge Functions

- `employee-login` resolves an employee number to a verified Auth email without exposing the email to the browser.
- `provision-employee` creates an employee account with the temporary password `PMS@2026` and creates the protected employee role mapping. Employees must change that password on first login.
- `payslip-download` generates or retrieves a private PDF and returns a short-lived signed URL.

Configure `SUPABASE_SERVICE_ROLE_KEY` only as a Supabase function secret. Never place it in a `VITE_*` variable.
