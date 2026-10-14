-- Validated administrator salary configuration CRUD for the prototype payroll engine.
-- Payroll snapshots remain immutable and protect the salary rows they used.

create or replace function public.pms_guard_salary_history_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.pms_is_admin() then
    raise exception 'Administrator access is required';
  end if;

  if tg_op in ('UPDATE', 'DELETE') and exists (
    select 1
      from public.pms_payroll_records payroll_record
     where payroll_record.calculation_snapshot ->> 'salary_id' = old.id::text
  ) then
    raise exception 'Salary configurations used by payroll cannot be changed; preserve the payroll history and add a replacement configuration instead';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if new.amount <= 0 then
    raise exception 'Salary amount must be positive';
  end if;
  if new.assignment_id is not null and not exists (
    select 1
      from public.pms_employee_assignments assignment
     where assignment.id = new.assignment_id
       and assignment.employee_id = new.employee_id
  ) then
    raise exception 'The assignment does not belong to the selected employee';
  end if;

  if tg_op = 'INSERT'
     or new.employee_id is distinct from old.employee_id
     or new.effective_from is distinct from old.effective_from
     or new.effective_to is distinct from old.effective_to then
    perform 1
      from public.pms_employees employee
     where employee.id = new.employee_id
     for update;
    if not found then
      raise exception 'A valid employee is required';
    end if;
    if exists (
      select 1
        from public.pms_employee_salary_history existing_salary
       where existing_salary.employee_id = new.employee_id
         and existing_salary.id <> new.id
         and existing_salary.effective_from <= coalesce(new.effective_to, 'infinity'::date)
         and coalesce(existing_salary.effective_to, 'infinity'::date) >= new.effective_from
    ) then
      raise exception 'Effective salary dates overlap another salary configuration for this employee';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists pms_salary_history_guard on public.pms_employee_salary_history;
create trigger pms_salary_history_guard
before insert or update or delete on public.pms_employee_salary_history
for each row execute function public.pms_guard_salary_history_mutation();

create or replace function public.pms_save_salary_configuration(
  p_salary_id uuid default null,
  p_values jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  values_json jsonb := coalesce(p_values, '{}'::jsonb);
  salary_row public.pms_employee_salary_history;
  employee_id_value uuid := nullif(trim(values_json ->> 'employee_id'), '')::uuid;
  assignment_id_value uuid := nullif(trim(values_json ->> 'assignment_id'), '')::uuid;
  salary_type_text text := nullif(trim(values_json ->> 'salary_type'), '');
  salary_type_value public.pms_salary_type;
  amount_value numeric := nullif(values_json ->> 'amount', '')::numeric;
  effective_from_value date := nullif(values_json ->> 'effective_from', '')::date;
  effective_to_value date := nullif(values_json ->> 'effective_to', '')::date;
  source_value text := coalesce(nullif(trim(values_json ->> 'source'), ''), 'Administrator configuration');
  approved_value boolean := coalesce(nullif(values_json ->> 'is_approved', '')::boolean, true);
  expected_updated_at_value timestamptz := nullif(values_json ->> 'expected_updated_at', '')::timestamptz;
begin
  if not public.pms_is_admin() then
    raise exception 'Administrator access is required';
  end if;
  if employee_id_value is null or not exists (select 1 from public.pms_employees where id = employee_id_value) then
    raise exception 'A valid employee is required';
  end if;
  if salary_type_text is null or salary_type_text not in ('monthly', 'daily', 'hourly') then
    raise exception 'A valid salary type is required';
  end if;
  salary_type_value := salary_type_text::public.pms_salary_type;
  if amount_value is null or amount_value <= 0 then
    raise exception 'Salary amount must be positive';
  end if;
  if effective_from_value is null then
    raise exception 'An effective-from date is required';
  end if;
  if effective_to_value is not null and effective_to_value < effective_from_value then
    raise exception 'Effective-to date cannot be before effective-from date';
  end if;
  if assignment_id_value is not null and not exists (
    select 1 from public.pms_employee_assignments
     where id = assignment_id_value and employee_id = employee_id_value
  ) then
    raise exception 'The assignment does not belong to the selected employee';
  end if;

  perform 1
    from public.pms_employees employee
   where employee.id = employee_id_value
   for update;

  if p_salary_id is not null then
    select * into salary_row
      from public.pms_employee_salary_history
     where id = p_salary_id
     for update;
    if salary_row.id is null then
      raise exception 'Salary configuration not found';
    end if;
    if salary_row.employee_id <> employee_id_value then
      raise exception 'An existing salary configuration cannot be moved to another employee';
    end if;
    if expected_updated_at_value is null then
      raise exception 'A salary configuration version is required when editing';
    end if;
    if salary_row.updated_at is distinct from expected_updated_at_value then
      raise exception 'This salary configuration changed while it was open; reload it before saving';
    end if;
  end if;

  if (p_salary_id is null or effective_from_value is distinct from salary_row.effective_from or effective_to_value is distinct from salary_row.effective_to)
     and exists (
      select 1
        from public.pms_employee_salary_history existing_salary
     where existing_salary.employee_id = employee_id_value
       and (p_salary_id is null or existing_salary.id <> p_salary_id)
       and existing_salary.effective_from <= coalesce(effective_to_value, 'infinity'::date)
       and coalesce(existing_salary.effective_to, 'infinity'::date) >= effective_from_value
  ) then
    raise exception 'Effective salary dates overlap another salary configuration for this employee';
  end if;

  if p_salary_id is null then
    insert into public.pms_employee_salary_history (
      employee_id, assignment_id, salary_type, amount, is_approved,
      effective_from, effective_to, source
    ) values (
      employee_id_value, assignment_id_value, salary_type_value, amount_value, approved_value,
      effective_from_value, effective_to_value, source_value
    ) returning * into salary_row;
  else
    update public.pms_employee_salary_history set
      assignment_id = assignment_id_value,
      salary_type = salary_type_value,
      amount = amount_value,
      is_approved = approved_value,
      effective_from = effective_from_value,
      effective_to = effective_to_value,
      source = source_value
    where id = p_salary_id
    returning * into salary_row;
  end if;

  return to_jsonb(salary_row);
end;
$$;

drop function if exists public.pms_delete_salary_configuration(uuid);

create or replace function public.pms_delete_salary_configuration(
  p_salary_id uuid,
  p_expected_updated_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  salary_row public.pms_employee_salary_history;
  employee_id_value uuid;
begin
  if not public.pms_is_admin() then
    raise exception 'Administrator access is required';
  end if;
  select * into salary_row
    from public.pms_employee_salary_history
   where id = p_salary_id;
  if salary_row.id is null then
    raise exception 'Salary configuration not found';
  end if;
  employee_id_value := salary_row.employee_id;
  perform 1
    from public.pms_employees employee
   where employee.id = employee_id_value
   for update;
  select * into salary_row
    from public.pms_employee_salary_history
   where id = p_salary_id
   for update;
  if salary_row.id is null then
    raise exception 'Salary configuration not found';
  end if;
  if p_expected_updated_at is null then
    raise exception 'A salary configuration version is required when deleting';
  end if;
  if salary_row.updated_at is distinct from p_expected_updated_at then
    raise exception 'This salary configuration changed while it was open; reload it before deleting';
  end if;
  delete from public.pms_employee_salary_history where id = p_salary_id;
end;
$$;

create or replace function public.pms_set_salary_approval(
  p_salary_id uuid,
  p_is_approved boolean,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  salary_row public.pms_employee_salary_history;
  employee_id_value uuid;
begin
  if not public.pms_is_admin() then
    raise exception 'Administrator access is required';
  end if;
  select * into salary_row
    from public.pms_employee_salary_history
   where id = p_salary_id;
  if salary_row.id is null then
    raise exception 'Salary configuration not found';
  end if;
  employee_id_value := salary_row.employee_id;
  perform 1
    from public.pms_employees employee
   where employee.id = employee_id_value
   for update;
  select * into salary_row
    from public.pms_employee_salary_history
   where id = p_salary_id
   for update;
  if salary_row.id is null then
    raise exception 'Salary configuration not found';
  end if;
  if p_expected_updated_at is null or salary_row.updated_at is distinct from p_expected_updated_at then
    raise exception 'This salary configuration changed while it was open; reload it before approving';
  end if;
  update public.pms_employee_salary_history
     set is_approved = coalesce(p_is_approved, false)
   where id = p_salary_id
   returning * into salary_row;
  return to_jsonb(salary_row);
end;
$$;

drop policy if exists salary_admin_write on public.pms_employee_salary_history;

revoke all on function public.pms_guard_salary_history_mutation() from public, anon, authenticated;
revoke all on function public.pms_save_salary_configuration(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.pms_delete_salary_configuration(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.pms_set_salary_approval(uuid, boolean, timestamptz) from public, anon, authenticated;
grant execute on function public.pms_save_salary_configuration(uuid, jsonb) to authenticated;
grant execute on function public.pms_delete_salary_configuration(uuid, timestamptz) to authenticated;
grant execute on function public.pms_set_salary_approval(uuid, boolean, timestamptz) to authenticated;

-- Keep the employee profile editor's remove action in sync with salary history.
alter function public.pms_save_employee_profile(jsonb, uuid)
  rename to pms_save_employee_profile_checked;

revoke all on function public.pms_save_employee_profile_checked(jsonb, uuid) from public, anon, authenticated;

create or replace function public.pms_save_employee_profile(
  p_payload jsonb,
  p_employee_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_employee_id uuid;
  salary_item jsonb;
  removal_item jsonb;
  salary_row public.pms_employee_salary_history;
  salary_id_value uuid;
  removal_id_value uuid;
  expected_updated_at_value timestamptz;
begin
  if not public.pms_is_admin() then
    raise exception 'Administrator access is required';
  end if;

  if p_employee_id is not null then
    perform 1
      from public.pms_employees employee
     where employee.id = p_employee_id
     for update;
    if not found then
      raise exception 'Employee not found';
    end if;
  end if;

  if p_employee_id is not null and p_payload ? 'salary_history' then
    for salary_item in
      select value from jsonb_array_elements(coalesce(p_payload -> 'salary_history', '[]'::jsonb))
    loop
      salary_id_value := nullif(salary_item ->> 'id', '')::uuid;
      if salary_id_value is null then
        continue;
      end if;
      expected_updated_at_value := nullif(salary_item ->> 'updated_at', '')::timestamptz;
      if expected_updated_at_value is null then
        raise exception 'Salary history changed detection requires reloading the employee profile before saving';
      end if;
      select * into salary_row
        from public.pms_employee_salary_history
       where id = salary_id_value and employee_id = p_employee_id
       for update;
      if salary_row.id is null then
        raise exception 'A salary configuration in this profile no longer exists';
      end if;
      if salary_row.updated_at is distinct from expected_updated_at_value then
        raise exception 'Salary history changed while this profile was open; reload it before saving';
      end if;
    end loop;
  end if;

  if p_employee_id is not null and jsonb_typeof(p_payload -> 'salary_history_removals') = 'array' then
    for removal_item in
      select value from jsonb_array_elements(p_payload -> 'salary_history_removals')
    loop
      removal_id_value := nullif(removal_item ->> 'id', '')::uuid;
      expected_updated_at_value := nullif(removal_item ->> 'updated_at', '')::timestamptz;
      if removal_id_value is null or expected_updated_at_value is null then
        raise exception 'A salary removal is missing its identity or change timestamp';
      end if;
      select * into salary_row
        from public.pms_employee_salary_history
       where id = removal_id_value and employee_id = p_employee_id
       for update;
      if salary_row.id is null then
        raise exception 'A salary configuration selected for removal no longer exists';
      end if;
      if salary_row.updated_at is distinct from expected_updated_at_value then
        raise exception 'Salary history changed while this profile was open; reload it before removing the salary';
      end if;
      delete from public.pms_employee_salary_history where id = removal_id_value;
    end loop;
  end if;

  saved_employee_id := public.pms_save_employee_profile_checked(p_payload, p_employee_id);

  return saved_employee_id;
end;
$$;

revoke all on function public.pms_save_employee_profile(jsonb, uuid) from public, anon;
grant execute on function public.pms_save_employee_profile(jsonb, uuid) to authenticated;

-- Serialize salary changes with finalization so a payroll snapshot cannot point at a row
-- that was edited or removed between preview and record creation.
create or replace function public.pms_finalize_payroll(
  p_payroll_period_id uuid,
  p_idempotency_key text
)
returns setof public.pms_payroll_records
language plpgsql
security definer
set search_path = public
as $$
declare
  period_row public.pms_payroll_periods;
  run_row public.pms_payroll_finalization_runs;
  preview_row record;
  employee_lock record;
  salary_lock record;
begin
  if not public.pms_is_admin() then
    raise exception 'Administrator access is required';
  end if;
  select * into period_row
    from public.pms_payroll_periods
   where id = p_payroll_period_id
   for update;
  if period_row.id is null then
    raise exception 'Payroll period not found';
  end if;
  if period_row.status in ('paid', 'cancelled') then
    raise exception 'This payroll period cannot be finalized';
  end if;
  select * into run_row
    from public.pms_payroll_finalization_runs
   where payroll_period_id = p_payroll_period_id;
  if run_row.id is not null then
    return query
      select * from public.pms_payroll_records
       where payroll_period_id = p_payroll_period_id
       order by employee_id;
    return;
  end if;
  if exists (
    select 1 from public.pms_payroll_finalization_runs
     where idempotency_key = p_idempotency_key
  ) then
    raise exception 'The finalization key has already been used for another payroll period';
  end if;

  for employee_lock in
    select employee.id
      from public.pms_employees employee
     where employee.status = 'active'
     order by employee.id
     for update
  loop
    null;
  end loop;
  for salary_lock in
    select salary.id
     from public.pms_employee_salary_history salary
      join public.pms_employees employee on employee.id = salary.employee_id
     where employee.status = 'active'
       and salary.effective_from <= period_row.end_date
       and (salary.effective_to is null or salary.effective_to >= period_row.start_date)
     order by salary.employee_id, salary.effective_from desc, salary.id
     for update of salary
  loop
    null;
  end loop;

  update public.pms_payroll_periods
     set status = 'processing'
   where id = p_payroll_period_id;
  for preview_row in select * from public.pms_preview_payroll(p_payroll_period_id) loop
    insert into public.pms_payroll_records (
      id, payroll_period_id, employee_id, salary_type, basic_pay, overtime_pay,
      other_income, gross_pay, employee_contributions, withholding_tax,
      loan_deductions, other_deductions, total_deductions, net_pay,
      calculation_version, calculation_snapshot, created_at
    ) values (
      preview_row.id, preview_row.payroll_period_id, preview_row.employee_id,
      preview_row.salary_type, preview_row.basic_pay, preview_row.overtime_pay,
      preview_row.other_income, preview_row.gross_pay,
      preview_row.employee_contributions, preview_row.withholding_tax,
      preview_row.loan_deductions, preview_row.other_deductions,
      preview_row.total_deductions, preview_row.net_pay,
      preview_row.calculation_version, preview_row.calculation_snapshot,
      preview_row.created_at
    );
    insert into public.pms_payroll_record_items (
      payroll_record_id, item_type, code, label, amount
    ) values
      (preview_row.id, 'earning', 'BASIC_PAY', 'Basic pay', preview_row.basic_pay),
      (preview_row.id, 'earning', 'OVERTIME', 'Overtime pay', preview_row.overtime_pay),
      (preview_row.id, 'earning', 'OTHER_INCOME', 'Other income', preview_row.other_income),
      (preview_row.id, 'contribution', 'EMPLOYEE_CONTRIBUTIONS', 'Employee contributions', preview_row.employee_contributions),
      (preview_row.id, 'tax', 'WITHHOLDING_TAX', 'Withholding tax', preview_row.withholding_tax),
      (preview_row.id, 'loan', 'LOAN_DEDUCTIONS', 'Loan deductions', preview_row.loan_deductions),
      (preview_row.id, 'deduction', 'OTHER_DEDUCTIONS', 'Other deductions', preview_row.other_deductions);
    insert into public.pms_loan_repayments (employee_loan_id, payroll_record_id, amount)
      select loan.id, preview_row.id,
        least(loan.installment_amount, loan.outstanding_balance)
        from public.pms_employee_loans loan
       where loan.employee_id = preview_row.employee_id
         and loan.status = 'active'
         and loan.priority is not null
         and loan.outstanding_balance > 0;
    update public.pms_employee_loans loan set
      outstanding_balance = greatest(0, loan.outstanding_balance - least(loan.installment_amount, loan.outstanding_balance)),
      status = case
        when loan.outstanding_balance - least(loan.installment_amount, loan.outstanding_balance) <= 0 then 'completed'
        else 'active'
      end
     where loan.employee_id = preview_row.employee_id
       and loan.status = 'active'
       and loan.priority is not null
       and loan.outstanding_balance > 0;
  end loop;
  insert into public.pms_employee_payslips (employee_id, payroll_record_id)
    select employee_id, id
      from public.pms_payroll_records
     where payroll_period_id = p_payroll_period_id
    on conflict (payroll_record_id) do nothing;
  insert into public.pms_payroll_finalization_runs (
    payroll_period_id, idempotency_key, finalized_by
  ) values (p_payroll_period_id, p_idempotency_key, auth.uid());
  update public.pms_payroll_periods
     set status = 'finalized', finalized_at = now()
   where id = p_payroll_period_id;
  return query
    select * from public.pms_payroll_records
     where payroll_period_id = p_payroll_period_id
     order by employee_id;
end;
$$;
