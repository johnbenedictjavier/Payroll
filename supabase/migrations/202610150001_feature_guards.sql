-- Server-side validation and guarded mutations for employee setup and payroll inputs.

alter function public.pms_save_employee_profile(jsonb, uuid)
  rename to pms_save_employee_profile_legacy;

revoke all on function public.pms_save_employee_profile_legacy(jsonb, uuid) from public, authenticated;

create or replace function public.pms_save_employee_profile(
  p_payload jsonb,
  p_employee_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  assignment_item jsonb;
  salary_item jsonb;
  assignment_count integer := 0;
  salary_count integer := 0;
  department_id_value uuid;
  position_id_value uuid;
  amount_value numeric;
begin
  if not public.pms_is_admin() then
    raise exception 'Administrator access is required';
  end if;

  if nullif(trim(p_payload -> 'employee' ->> 'first_name'), '') is null
     or nullif(trim(p_payload -> 'employee' ->> 'last_name'), '') is null then
    raise exception 'First name and last name are required';
  end if;

  for assignment_item in
    select value from jsonb_array_elements(coalesce(p_payload -> 'assignments', '[]'::jsonb))
  loop
    department_id_value := nullif(assignment_item ->> 'department_id', '')::uuid;
    position_id_value := nullif(assignment_item ->> 'position_id', '')::uuid;

    if department_id_value is null or position_id_value is null
       or nullif(assignment_item ->> 'start_date', '') is null then
      raise exception 'Every employee must have a department, position, and assignment start date';
    end if;
    if not exists (
      select 1 from public.pms_departments
       where id = department_id_value and is_active = true
    ) then
      raise exception 'Employee assignments must use active departments';
    end if;
    if not exists (
      select 1 from public.pms_positions
       where id = position_id_value
         and department_id = department_id_value
         and is_active = true
    ) then
      raise exception 'Employee assignments must use an active position from the selected department';
    end if;
    assignment_count := assignment_count + 1;
  end loop;

  if assignment_count = 0 then
    raise exception 'At least one active department and position assignment is required';
  end if;

  for salary_item in
    select value from jsonb_array_elements(coalesce(p_payload -> 'salary_history', '[]'::jsonb))
  loop
    amount_value := nullif(salary_item ->> 'amount', '')::numeric;
    if amount_value is not null and amount_value > 0
       and nullif(salary_item ->> 'effective_from', '') is not null then
      salary_count := salary_count + 1;
    end if;
  end loop;

  if salary_count = 0 then
    raise exception 'At least one positive salary is required';
  end if;

  return public.pms_save_employee_profile_legacy(p_payload, p_employee_id);
end;
$$;

grant execute on function public.pms_save_employee_profile(jsonb, uuid) to authenticated;

create or replace function public.pms_statutory_status()
returns table (
  schedule_type text,
  status text,
  effective_from date,
  source_reference text,
  source_url text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.pms_is_admin() then
    raise exception 'Administrator access is required';
  end if;

  return query
  with required_types(schedule_type) as (
    values ('sss'::text), ('philhealth'::text), ('pagibig'::text), ('withholding_tax'::text)
  )
  select required_types.schedule_type,
    case when schedule_row.id is null then 'NEEDED' else 'RECORDED' end,
    schedule_row.effective_from,
    schedule_row.source_reference,
    schedule_row.source_url
  from required_types
  left join lateral (
    select id, effective_from, source_reference, source_url
      from public.pms_legacy_statutory_rate_schedules
     where pms_legacy_statutory_rate_schedules.schedule_type = required_types.schedule_type
     order by effective_from desc, updated_at desc
     limit 1
  ) schedule_row on true
  order by case required_types.schedule_type
    when 'sss' then 1
    when 'philhealth' then 2
    when 'pagibig' then 3
    else 4
  end;
end;
$$;

grant execute on function public.pms_statutory_status() to authenticated;

create or replace function public.pms_update_payroll_period(
  p_period_id uuid,
  p_values jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  period_row public.pms_payroll_periods;
begin
  if not public.pms_is_admin() then raise exception 'Administrator access is required'; end if;
  select * into period_row from public.pms_payroll_periods where id = p_period_id for update;
  if period_row.id is null then raise exception 'Payroll period not found'; end if;
  if period_row.status <> 'draft' then raise exception 'Only draft payroll periods can be edited'; end if;

  update public.pms_payroll_periods set
    name = coalesce(nullif(trim(p_values ->> 'name'), ''), name),
    start_date = coalesce(nullif(p_values ->> 'start_date', '')::date, start_date),
    end_date = coalesce(nullif(p_values ->> 'end_date', '')::date, end_date),
    pay_date = coalesce(nullif(p_values ->> 'pay_date', '')::date, pay_date),
    frequency = coalesce(nullif(p_values ->> 'frequency', '')::text, frequency)
  where id = p_period_id
  returning * into period_row;
  return to_jsonb(period_row);
end;
$$;

create or replace function public.pms_delete_payroll_period(p_period_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  period_row public.pms_payroll_periods;
begin
  if not public.pms_is_admin() then raise exception 'Administrator access is required'; end if;
  select * into period_row from public.pms_payroll_periods where id = p_period_id for update;
  if period_row.id is null then raise exception 'Payroll period not found'; end if;
  if period_row.status <> 'draft' then raise exception 'Only empty draft payroll periods can be deleted'; end if;
  if exists (select 1 from public.pms_employee_attendance where payroll_period_id = p_period_id)
     or exists (select 1 from public.pms_other_income where payroll_period_id = p_period_id)
     or exists (select 1 from public.pms_other_deductions where payroll_period_id = p_period_id)
     or exists (select 1 from public.pms_payroll_records where payroll_period_id = p_period_id) then
    raise exception 'This payroll period is referenced; cancel it instead of deleting it';
  end if;
  delete from public.pms_payroll_periods where id = p_period_id;
end;
$$;

create or replace function public.pms_cancel_payroll_period(p_period_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.pms_is_admin() then raise exception 'Administrator access is required'; end if;
  update public.pms_payroll_periods
     set status = 'cancelled'
   where id = p_period_id and status not in ('finalized', 'paid', 'cancelled');
  if not found then raise exception 'Only open payroll periods can be cancelled'; end if;
end;
$$;

create or replace function public.pms_upsert_attendance(
  p_payroll_period_id uuid,
  p_employee_id uuid,
  p_days_worked numeric,
  p_absence_days numeric,
  p_tardiness_minutes numeric,
  p_undertime_minutes numeric,
  p_overtime_hours numeric,
  p_notes text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  period_status public.pms_payroll_status;
  attendance_row public.pms_employee_attendance;
begin
  if not public.pms_is_admin() then raise exception 'Administrator access is required'; end if;
  select status into period_status from public.pms_payroll_periods where id = p_payroll_period_id;
  if period_status is null then raise exception 'Payroll period not found'; end if;
  if period_status in ('finalized', 'paid', 'cancelled') then raise exception 'Attendance cannot be changed for a locked payroll period'; end if;
  if least(p_days_worked, p_absence_days, p_tardiness_minutes, p_undertime_minutes, p_overtime_hours) < 0 then
    raise exception 'Attendance values cannot be negative';
  end if;

  insert into public.pms_employee_attendance (
    payroll_period_id, employee_id, days_worked, absence_days,
    tardiness_minutes, undertime_minutes, overtime_hours, notes
  ) values (
    p_payroll_period_id, p_employee_id, coalesce(p_days_worked, 0), coalesce(p_absence_days, 0),
    coalesce(p_tardiness_minutes, 0), coalesce(p_undertime_minutes, 0), coalesce(p_overtime_hours, 0), nullif(trim(p_notes), '')
  )
  on conflict (payroll_period_id, employee_id) do update set
    days_worked = excluded.days_worked,
    absence_days = excluded.absence_days,
    tardiness_minutes = excluded.tardiness_minutes,
    undertime_minutes = excluded.undertime_minutes,
    overtime_hours = excluded.overtime_hours,
    notes = excluded.notes,
    updated_at = now()
  returning * into attendance_row;
  return to_jsonb(attendance_row);
end;
$$;

create or replace function public.pms_delete_attendance(p_attendance_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  period_status public.pms_payroll_status;
begin
  if not public.pms_is_admin() then raise exception 'Administrator access is required'; end if;
  select period.status into period_status
    from public.pms_employee_attendance attendance
    join public.pms_payroll_periods period on period.id = attendance.payroll_period_id
   where attendance.id = p_attendance_id;
  if period_status is null then raise exception 'Attendance record not found'; end if;
  if period_status in ('finalized', 'paid', 'cancelled') then raise exception 'Attendance cannot be deleted for a locked payroll period'; end if;
  delete from public.pms_employee_attendance where id = p_attendance_id;
end;
$$;

create or replace function public.pms_update_loan_type(
  p_loan_type_id uuid,
  p_values jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  loan_type_row public.pms_loan_types;
begin
  if not public.pms_is_admin() then raise exception 'Administrator access is required'; end if;
  update public.pms_loan_types set
    name = coalesce(nullif(trim(p_values ->> 'name'), ''), name),
    description = case when p_values ? 'description' then nullif(trim(p_values ->> 'description'), '') else description end,
    default_terms = case when p_values ? 'default_terms' then nullif(p_values ->> 'default_terms', '')::integer else default_terms end,
    is_active = case when p_values ? 'is_active' then (p_values ->> 'is_active')::boolean else is_active end
  where id = p_loan_type_id
  returning * into loan_type_row;
  if loan_type_row.id is null then raise exception 'Loan type not found'; end if;
  return to_jsonb(loan_type_row);
end;
$$;

create or replace function public.pms_delete_loan_type(p_loan_type_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.pms_is_admin() then raise exception 'Administrator access is required'; end if;
  if exists (select 1 from public.pms_employee_loans where loan_type_id = p_loan_type_id) then
    raise exception 'Referenced loan types cannot be deleted; deactivate them instead';
  end if;
  delete from public.pms_loan_types where id = p_loan_type_id;
  if not found then raise exception 'Loan type not found'; end if;
end;
$$;

create or replace function public.pms_update_employee_loan(
  p_loan_id uuid,
  p_values jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  loan_row public.pms_employee_loans;
begin
  if not public.pms_is_admin() then raise exception 'Administrator access is required'; end if;
  if exists (select 1 from public.pms_loan_repayments where employee_loan_id = p_loan_id) then
    raise exception 'Employee loans cannot be edited after repayment; record a source correction instead';
  end if;
  select * into loan_row from public.pms_employee_loans where id = p_loan_id for update;
  if loan_row.id is null then raise exception 'Employee loan not found'; end if;
  if p_values ? 'principal_amount' and (p_values ->> 'principal_amount')::numeric <= 0 then raise exception 'Principal amount must be positive'; end if;
  if p_values ? 'repayment_terms' and (p_values ->> 'repayment_terms')::integer <= 0 then raise exception 'Repayment terms must be positive'; end if;
  if p_values ? 'installment_amount' and (p_values ->> 'installment_amount')::numeric <= 0 then raise exception 'Installment amount must be positive'; end if;

  update public.pms_employee_loans set
    loan_type_id = case when p_values ? 'loan_type_id' then (p_values ->> 'loan_type_id')::uuid else loan_type_id end,
    loan_date = case when p_values ? 'loan_date' then (p_values ->> 'loan_date')::date else loan_date end,
    principal_amount = case when p_values ? 'principal_amount' then (p_values ->> 'principal_amount')::numeric else principal_amount end,
    repayment_terms = case when p_values ? 'repayment_terms' then (p_values ->> 'repayment_terms')::integer else repayment_terms end,
    installment_amount = case when p_values ? 'installment_amount' then (p_values ->> 'installment_amount')::numeric else installment_amount end,
    outstanding_balance = case when p_values ? 'principal_amount' then (p_values ->> 'principal_amount')::numeric else outstanding_balance end,
    priority = case when p_values ? 'priority' then nullif(p_values ->> 'priority', '')::integer else priority end,
    status = case when p_values ? 'status' then (p_values ->> 'status')::public.pms_loan_status else status end
  where id = p_loan_id
  returning * into loan_row;
  return to_jsonb(loan_row);
end;
$$;

create or replace function public.pms_delete_employee_loan(p_loan_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.pms_is_admin() then raise exception 'Administrator access is required'; end if;
  if exists (select 1 from public.pms_loan_repayments where employee_loan_id = p_loan_id) then
    raise exception 'Employee loans with repayments cannot be deleted';
  end if;
  delete from public.pms_employee_loans where id = p_loan_id;
  if not found then raise exception 'Employee loan not found'; end if;
end;
$$;

grant execute on function public.pms_update_payroll_period(uuid, jsonb) to authenticated;
grant execute on function public.pms_delete_payroll_period(uuid) to authenticated;
grant execute on function public.pms_cancel_payroll_period(uuid) to authenticated;
grant execute on function public.pms_upsert_attendance(uuid, uuid, numeric, numeric, numeric, numeric, numeric, text) to authenticated;
grant execute on function public.pms_delete_attendance(uuid) to authenticated;
grant execute on function public.pms_update_loan_type(uuid, jsonb) to authenticated;
grant execute on function public.pms_delete_loan_type(uuid) to authenticated;
grant execute on function public.pms_update_employee_loan(uuid, jsonb) to authenticated;
grant execute on function public.pms_delete_employee_loan(uuid) to authenticated;

create or replace function public.pms_prevent_finalized_payroll_mutation() returns trigger
language plpgsql security invoker set search_path = public as $$
declare
  payroll_state public.pms_payroll_status;
begin
  if tg_op <> 'INSERT' then
    select status into payroll_state from public.pms_payroll_periods
     where id = old.payroll_period_id;
    if payroll_state in ('finalized', 'paid') then
      raise exception 'Finalized payroll records are immutable';
    end if;
  end if;
  if tg_op <> 'DELETE' then
    select status into payroll_state from public.pms_payroll_periods
     where id = new.payroll_period_id;
    if payroll_state in ('finalized', 'paid') then
      raise exception 'Finalized payroll records are immutable';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop policy if exists periods_admin_write on public.pms_payroll_periods;
create policy periods_admin_insert on public.pms_payroll_periods
  for insert to authenticated
  with check (public.pms_is_admin() and status = 'draft');

drop policy if exists attendance_admin_write on public.pms_employee_attendance;

drop policy if exists loan_types_admin_write on public.pms_loan_types;
create policy loan_types_admin_insert on public.pms_loan_types
  for insert to authenticated
  with check (public.pms_is_admin());

drop policy if exists loans_admin_write on public.pms_employee_loans;
create policy loans_admin_insert on public.pms_employee_loans
  for insert to authenticated
  with check (public.pms_is_admin());

create or replace function public.pms_guard_attendance_period() returns trigger
language plpgsql security invoker set search_path = public as $$
declare
  period_status public.pms_payroll_status;
begin
  if tg_op <> 'INSERT' then
    select status into period_status from public.pms_payroll_periods
     where id = old.payroll_period_id;
    if period_status in ('finalized', 'paid', 'cancelled') then
      raise exception 'Attendance cannot be changed for a locked payroll period';
    end if;
  end if;
  if tg_op <> 'DELETE' then
    select status into period_status from public.pms_payroll_periods
     where id = new.payroll_period_id;
    if period_status in ('finalized', 'paid', 'cancelled') then
      raise exception 'Attendance cannot be changed for a locked payroll period';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists pms_attendance_period_guard on public.pms_employee_attendance;
create trigger pms_attendance_period_guard
before insert or update or delete on public.pms_employee_attendance
for each row execute function public.pms_guard_attendance_period();

create or replace function public.pms_guard_repaid_loan_mutation() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if exists (select 1 from public.pms_loan_repayments where employee_loan_id = coalesce(new.id, old.id)) then
    raise exception 'Employee loans with repayments cannot be edited or deleted';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- Employee-loan updates are restricted to the guarded RPC above. The trigger is
-- intentionally not installed because payroll finalization updates a loan
-- immediately after creating its repayment record in the same transaction.

create or replace function public.pms_guard_transaction_period() returns trigger
language plpgsql security invoker set search_path = public as $$
declare
  period_status public.pms_payroll_status;
begin
  if tg_op <> 'INSERT' then
    select status into period_status from public.pms_payroll_periods
     where id = old.payroll_period_id;
    if period_status in ('finalized', 'paid', 'cancelled') then
      raise exception 'Payroll transactions cannot be changed for a locked payroll period';
    end if;
  end if;
  if tg_op <> 'DELETE' then
    select status into period_status from public.pms_payroll_periods
     where id = new.payroll_period_id;
    if period_status in ('finalized', 'paid', 'cancelled') then
      raise exception 'Payroll transactions cannot be changed for a locked payroll period';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists pms_other_income_period_guard on public.pms_other_income;
create trigger pms_other_income_period_guard
before insert or update or delete on public.pms_other_income
for each row execute function public.pms_guard_transaction_period();

drop trigger if exists pms_other_deductions_period_guard on public.pms_other_deductions;
create trigger pms_other_deductions_period_guard
before insert or update or delete on public.pms_other_deductions
for each row execute function public.pms_guard_transaction_period();

drop policy if exists income_admin_all on public.pms_other_income;
create policy income_admin_read on public.pms_other_income
  for select to authenticated using (public.pms_is_admin());
create policy income_admin_insert on public.pms_other_income
  for insert to authenticated with check (public.pms_is_admin());
create policy income_admin_update on public.pms_other_income
  for update to authenticated using (public.pms_is_admin()) with check (public.pms_is_admin());

drop policy if exists deductions_admin_all on public.pms_other_deductions;
create policy deductions_admin_read on public.pms_other_deductions
  for select to authenticated using (public.pms_is_admin());
create policy deductions_admin_insert on public.pms_other_deductions
  for insert to authenticated with check (public.pms_is_admin());
create policy deductions_admin_update on public.pms_other_deductions
  for update to authenticated using (public.pms_is_admin()) with check (public.pms_is_admin());

drop policy if exists record_items_admin_write on public.pms_payroll_record_items;
drop policy if exists payroll_records_admin_insert on public.pms_payroll_records;
create policy payroll_records_admin_insert on public.pms_payroll_records
  for insert to authenticated
  with check (
    public.pms_is_admin()
    and exists (
      select 1 from public.pms_payroll_periods period
       where period.id = payroll_period_id
         and period.status in ('draft', 'processing')
    )
  );

create policy record_items_admin_insert on public.pms_payroll_record_items
  for insert to authenticated with check (
    public.pms_is_admin()
    and exists (
      select 1
        from public.pms_payroll_records record
        join public.pms_payroll_periods period on period.id = record.payroll_period_id
       where record.id = payroll_record_id
         and period.status in ('draft', 'processing')
    )
  );

drop policy if exists payslips_admin_write on public.pms_employee_payslips;
create policy payslips_admin_insert on public.pms_employee_payslips
  for insert to authenticated with check (
    public.pms_is_admin()
    and exists (
      select 1
        from public.pms_payroll_records record
        join public.pms_payroll_periods period on period.id = record.payroll_period_id
       where record.id = payroll_record_id
         and period.status in ('draft', 'processing')
    )
  );

create or replace function public.pms_employee_has_payroll_period(p_period_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.pms_payroll_records record
      join public.pms_employee_payslips slip on slip.payroll_record_id = record.id
     where record.payroll_period_id = p_period_id
       and record.employee_id = public.pms_current_employee_id()
       and slip.published_at is not null
  );
$$;

create or replace function public.pms_is_published_payroll_period(p_period_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.pms_payroll_records record
      join public.pms_employee_payslips slip on slip.payroll_record_id = record.id
     where record.payroll_period_id = p_period_id
       and record.employee_id = public.pms_current_employee_id()
       and slip.published_at is not null
  );
$$;

drop policy if exists payroll_records_admin_or_published_employee on public.pms_payroll_records;
create policy payroll_records_admin_or_published_employee on public.pms_payroll_records
  for select to authenticated using (
    public.pms_is_admin()
    or (employee_id = public.pms_current_employee_id() and public.pms_is_published_payroll_period(payroll_period_id))
  );

drop policy if exists record_items_admin_or_own on public.pms_payroll_record_items;
create policy record_items_admin_or_published_own on public.pms_payroll_record_items
  for select to authenticated using (
    public.pms_is_admin()
    or exists (
      select 1
        from public.pms_payroll_records record
        join public.pms_employee_payslips slip on slip.payroll_record_id = record.id
       where record.id = payroll_record_id
         and record.employee_id = public.pms_current_employee_id()
         and slip.published_at is not null
    )
  );
