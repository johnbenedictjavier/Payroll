# Supabase Operations

## Apply migrations

Apply the migrations in order to the selected Supabase project using the Supabase CLI or SQL editor. `202610110001_initial_schema.sql` creates the canonical schema, RLS policies, private Storage buckets, audit triggers, payroll functions, and payslip publication workflow. `202610110002_employee_management.sql` adds full employee-profile saving, automatic employee numbers, private DOCX retention, and first-login password controls. `202610110003_employee_number_rules.sql` makes employee numbers immutable after creation. `202610110004_repair_updated_at_columns.sql` repairs pre-existing PMS tables so profile updates can run their timestamp triggers safely.

The shared Supabase project has unrelated pre-existing student-system migration history. Those migrations are intentionally not included in this Payroll application's `supabase/migrations/` directory and are not referenced by Payroll. Do not remove the existing remote student objects unless the student system is being retired.

Because those remote history entries are intentionally absent locally, a future CLI `db push` may require temporarily running `supabase migration fetch`, applying the PMS migration, and then deleting the fetched LQ files again. Never mark the remote LQ migrations as reverted.

## Required setup before payroll

1. Create or import administrator Auth accounts with verified email addresses.
2. Insert matching `pms_user_roles` rows with the `admin` role using a trusted operation.
3. Configure an active `pms_payroll_policies` row through the administrator portal.
4. Add approved SSS, PhilHealth, Pag-IBIG, and withholding-tax schedules to `pms_statutory_rate_schedules` using official source references.
5. Review imported employees, emails, assignments, salaries, and profile images.

No statutory rate is embedded in the migration. Payroll preview intentionally refuses to run until all four approved schedule types are configured for the payroll period.

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
