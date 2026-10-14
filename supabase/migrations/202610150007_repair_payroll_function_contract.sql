-- Repair deployments where the finalizer was updated but the preview RPC still
-- exposes the legacy return contract. PostgreSQL cannot change a function's
-- OUT-parameter row type with CREATE OR REPLACE, so the preview function must
-- be dropped and recreated as one compatible contract.

drop function if exists public.pms_preview_payroll(uuid);

create function public.pms_preview_payroll(p_payroll_period_id uuid)
returns table (
  id uuid,
  payroll_period_id uuid,
  employee_id uuid,
  salary_type public.pms_salary_type,
  base_pay numeric,
  attendance_deductions numeric,
  basic_pay numeric,
  overtime_pay numeric,
  other_income numeric,
  gross_pay numeric,
  employee_contributions numeric,
  employer_contributions numeric,
  withholding_tax numeric,
  loan_deductions numeric,
  other_deductions numeric,
  total_deductions numeric,
  net_pay numeric,
  attendance_days_worked numeric,
  absence_days numeric,
  tardiness_minutes numeric,
  undertime_minutes numeric,
  overtime_hours numeric,
  hourly_rate numeric,
  calculation_version text,
  calculation_snapshot jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period public.pms_payroll_periods;
  v_employee public.pms_employees;
  v_salary public.pms_employee_salary_history;
  v_attendance public.pms_employee_attendance;
  v_sss_parameters jsonb;
  v_philhealth_parameters jsonb;
  v_pagibig_parameters jsonb;
  v_tax_parameters jsonb;
  v_sss_rule_id uuid;
  v_philhealth_rule_id uuid;
  v_pagibig_rule_id uuid;
  v_tax_rule_id uuid;
  v_sss_effective date;
  v_philhealth_effective date;
  v_pagibig_effective date;
  v_tax_effective date;
  v_base numeric;
  v_attendance_deduction numeric;
  v_basic numeric;
  v_hourly numeric;
  v_overtime numeric;
  v_income numeric;
  v_loan numeric;
  v_other_deduction numeric;
  v_gross numeric;
  v_monthly_salary_base numeric;
  v_period_divisor numeric;
  v_sss_msc numeric;
  v_sss_monthly_employee numeric;
  v_sss_monthly_employer numeric;
  v_philhealth_base numeric;
  v_philhealth_monthly_employee numeric;
  v_philhealth_monthly_employer numeric;
  v_pagibig_base numeric;
  v_pagibig_monthly_employee numeric;
  v_pagibig_monthly_employer numeric;
  v_employee_contributions numeric;
  v_employer_contributions numeric;
  v_taxable_monthly numeric;
  v_withholding_monthly numeric;
  v_withholding numeric;
  v_total numeric;
  v_net numeric;
begin
  if not public.pms_is_admin() then
    raise exception 'Administrator access is required';
  end if;

  select period.* into v_period
    from public.pms_payroll_periods period
   where period.id = p_payroll_period_id;
  if v_period.id is null then raise exception 'Payroll period not found'; end if;
  if v_period.status in ('finalized', 'paid', 'cancelled') then
    raise exception 'This payroll period cannot be previewed';
  end if;

  select rule.id, rule.parameters, rule.effective_from into v_sss_rule_id, v_sss_parameters, v_sss_effective
    from public.pms_payroll_statutory_rules rule
   where rule.rule_type = 'sss' and rule.status = 'approved'
     and rule.effective_from <= v_period.end_date
     and (rule.effective_to is null or rule.effective_to >= v_period.start_date)
   order by rule.effective_from desc limit 1;
  select rule.id, rule.parameters, rule.effective_from into v_philhealth_rule_id, v_philhealth_parameters, v_philhealth_effective
    from public.pms_payroll_statutory_rules rule
   where rule.rule_type = 'philhealth' and rule.status = 'approved'
     and rule.effective_from <= v_period.end_date
     and (rule.effective_to is null or rule.effective_to >= v_period.start_date)
   order by rule.effective_from desc limit 1;
  select rule.id, rule.parameters, rule.effective_from into v_pagibig_rule_id, v_pagibig_parameters, v_pagibig_effective
    from public.pms_payroll_statutory_rules rule
   where rule.rule_type = 'pagibig' and rule.status = 'approved'
     and rule.effective_from <= v_period.end_date
     and (rule.effective_to is null or rule.effective_to >= v_period.start_date)
   order by rule.effective_from desc limit 1;
  select rule.id, rule.parameters, rule.effective_from into v_tax_rule_id, v_tax_parameters, v_tax_effective
    from public.pms_payroll_statutory_rules rule
   where rule.rule_type = 'withholding_tax' and rule.status = 'approved'
     and rule.effective_from <= v_period.end_date
     and (rule.effective_to is null or rule.effective_to >= v_period.start_date)
   order by rule.effective_from desc limit 1;
  if v_sss_rule_id is null or v_philhealth_rule_id is null or v_pagibig_rule_id is null or v_tax_rule_id is null then
    raise exception 'Approved statutory rules are not available for this payroll period';
  end if;

  v_period_divisor := case when v_period.frequency = 'semi_monthly' then 2 else 1 end;

  for v_employee in
    select employee.*
      from public.pms_employees employee
     where employee.status = 'active'
     order by employee.last_name, employee.first_name
  loop
    select salary.* into v_salary
      from public.pms_employee_salary_history salary
     where salary.employee_id = v_employee.id
       and salary.is_approved = true
       and salary.effective_from <= v_period.end_date
       and (salary.effective_to is null or salary.effective_to >= v_period.start_date)
     order by salary.effective_from desc
     limit 1;
    if v_salary.id is null then
      raise exception 'No effective salary configuration for employee %', v_employee.employee_number;
    end if;

    select attendance.* into v_attendance
      from public.pms_employee_attendance attendance
     where attendance.employee_id = v_employee.id
       and attendance.payroll_period_id = p_payroll_period_id;
    if v_attendance.id is null then
      raise exception 'Missing attendance record for employee %', v_employee.employee_number;
    end if;
    if exists (
      select 1 from public.pms_employee_loans loan
       where loan.employee_id = v_employee.id
         and loan.status = 'active'
         and loan.priority is null
    ) then
      raise exception 'An active loan without administrator priority exists for employee %', v_employee.employee_number;
    end if;

    v_hourly := case
      when v_salary.salary_type = 'hourly' then v_salary.amount
      when v_salary.salary_type = 'daily' then v_salary.amount / 8
      when v_salary.salary_type = 'monthly' then v_salary.amount / 26 / 8
      else 0
    end;
    v_base := case
      when v_salary.salary_type = 'monthly' then v_salary.amount / v_period_divisor
      when v_salary.salary_type = 'daily' then v_salary.amount * v_attendance.days_worked
      else v_salary.amount * v_attendance.days_worked * 8
    end;
    v_attendance_deduction :=
      (v_attendance.tardiness_minutes * v_hourly / 60)
      + (v_attendance.undertime_minutes * v_hourly / 60)
      + case
          when v_salary.salary_type = 'monthly'
            then v_attendance.absence_days * v_salary.amount / 26
          else 0
        end;
    v_basic := greatest(0, v_base - v_attendance_deduction);
    v_overtime := v_attendance.overtime_hours * v_hourly * 1.25;

    select coalesce(sum(income.amount), 0) into v_income
      from public.pms_other_income income
     where income.employee_id = v_employee.id
       and income.payroll_period_id = p_payroll_period_id
       and income.status = 'approved';
    select coalesce(sum(deduction.amount), 0) into v_other_deduction
      from public.pms_other_deductions deduction
     where deduction.employee_id = v_employee.id
       and deduction.payroll_period_id = p_payroll_period_id
       and deduction.status = 'approved';
    select coalesce(sum(least(loan.installment_amount, loan.outstanding_balance)), 0) into v_loan
      from public.pms_employee_loans loan
     where loan.employee_id = v_employee.id
       and loan.status = 'active'
       and loan.priority is not null;

    v_gross := round(v_basic + v_overtime + v_income, 2);
    v_monthly_salary_base := case
      when v_salary.salary_type = 'monthly' then v_salary.amount
      when v_salary.salary_type = 'daily' then v_salary.amount * 26
      else v_salary.amount * 208
    end;
    v_sss_msc := least(
      coalesce((v_sss_parameters ->> 'maximum_msc')::numeric, 35000),
      greatest(
        coalesce((v_sss_parameters ->> 'minimum_msc')::numeric, 4000),
        ceil(v_monthly_salary_base / coalesce((v_sss_parameters ->> 'msc_step')::numeric, 500))
          * coalesce((v_sss_parameters ->> 'msc_step')::numeric, 500)
      )
    );
    v_sss_monthly_employee := v_sss_msc * coalesce((v_sss_parameters ->> 'employee_rate')::numeric, 0.05);
    v_sss_monthly_employer := v_sss_msc * coalesce((v_sss_parameters ->> 'employer_rate')::numeric, 0.10)
      + case when v_sss_msc >= coalesce((v_sss_parameters ->> 'employer_ec_threshold')::numeric, 15000)
          then coalesce((v_sss_parameters ->> 'employer_ec_at_or_above_threshold')::numeric, 30)
          else coalesce((v_sss_parameters ->> 'employer_ec_below_threshold')::numeric, 10)
        end;
    v_philhealth_base := least(
      coalesce((v_philhealth_parameters ->> 'maximum_monthly_base')::numeric, 100000),
      greatest(coalesce((v_philhealth_parameters ->> 'minimum_monthly_base')::numeric, 10000), v_monthly_salary_base)
    );
    v_philhealth_monthly_employee := v_philhealth_base * coalesce((v_philhealth_parameters ->> 'employee_rate')::numeric, 0.025);
    v_philhealth_monthly_employer := v_philhealth_base * coalesce((v_philhealth_parameters ->> 'employer_rate')::numeric, 0.025);
    v_pagibig_base := least(
      coalesce((v_pagibig_parameters ->> 'maximum_monthly_fund_salary')::numeric, 10000),
      greatest(0, v_monthly_salary_base)
    );
    v_pagibig_monthly_employee := v_pagibig_base * case
      when v_monthly_salary_base <= coalesce((v_pagibig_parameters ->> 'low_salary_threshold')::numeric, 1500)
        then coalesce((v_pagibig_parameters ->> 'employee_rate_low')::numeric, 0.01)
      else coalesce((v_pagibig_parameters ->> 'employee_rate_high')::numeric, 0.02)
    end;
    v_pagibig_monthly_employer := v_pagibig_base * coalesce((v_pagibig_parameters ->> 'employer_rate')::numeric, 0.02);
    v_employee_contributions := round((v_sss_monthly_employee + v_philhealth_monthly_employee + v_pagibig_monthly_employee) / v_period_divisor, 2);
    v_employer_contributions := round((v_sss_monthly_employer + v_philhealth_monthly_employer + v_pagibig_monthly_employer) / v_period_divisor, 2);
    v_taxable_monthly := greatest(
      0,
      (v_gross * v_period_divisor) - v_sss_monthly_employee - v_philhealth_monthly_employee - v_pagibig_monthly_employee
    );
    v_withholding_monthly := public.pms_calculate_withholding_tax(v_taxable_monthly, v_tax_parameters);
    v_withholding := round(v_withholding_monthly / v_period_divisor, 2);
    v_total := round(v_employee_contributions + v_withholding + v_loan + v_other_deduction, 2);
    v_net := round(v_gross - v_total, 2);
    if v_net < 0 then raise exception 'Net pay would be negative for employee %', v_employee.employee_number; end if;

    id := gen_random_uuid();
    payroll_period_id := p_payroll_period_id;
    employee_id := v_employee.id;
    salary_type := v_salary.salary_type;
    base_pay := round(v_base, 2);
    attendance_deductions := round(v_attendance_deduction, 2);
    basic_pay := round(v_basic, 2);
    overtime_pay := round(v_overtime, 2);
    other_income := round(v_income, 2);
    gross_pay := v_gross;
    employee_contributions := v_employee_contributions;
    employer_contributions := v_employer_contributions;
    withholding_tax := v_withholding;
    loan_deductions := round(v_loan, 2);
    other_deductions := round(v_other_deduction, 2);
    total_deductions := v_total;
    net_pay := v_net;
    attendance_days_worked := v_attendance.days_worked;
    absence_days := v_attendance.absence_days;
    tardiness_minutes := v_attendance.tardiness_minutes;
    undertime_minutes := v_attendance.undertime_minutes;
    overtime_hours := v_attendance.overtime_hours;
    hourly_rate := round(v_hourly, 2);
    calculation_version := 'payroll-v3-official-schedules';
    calculation_snapshot := jsonb_build_object(
      'version', 'payroll-v3-official-schedules',
      'salary_id', v_salary.id,
      'attendance_id', v_attendance.id,
      'period_id', v_period.id,
      'attendance', jsonb_build_object(
        'days_worked', v_attendance.days_worked,
        'absence_days', v_attendance.absence_days,
        'tardiness_minutes', v_attendance.tardiness_minutes,
        'undertime_minutes', v_attendance.undertime_minutes,
        'overtime_hours', v_attendance.overtime_hours,
        'notes', v_attendance.notes
      ),
      'base_pay', round(v_base, 2),
      'attendance_deductions', round(v_attendance_deduction, 2),
      'hourly_rate', round(v_hourly, 2),
      'work_days_per_period', 26,
      'hours_per_day', 8,
      'overtime_multiplier', 1.25,
      'period_divisor', v_period_divisor,
      'monthly_salary_base', round(v_monthly_salary_base, 2),
      'statutory', jsonb_build_object(
        'sss', jsonb_build_object('employee', round(v_sss_monthly_employee / v_period_divisor, 2), 'employer', round(v_sss_monthly_employer / v_period_divisor, 2), 'msc', round(v_sss_msc, 2), 'rule_id', v_sss_rule_id, 'effective_from', v_sss_effective),
        'philhealth', jsonb_build_object('employee', round(v_philhealth_monthly_employee / v_period_divisor, 2), 'employer', round(v_philhealth_monthly_employer / v_period_divisor, 2), 'base', round(v_philhealth_base, 2), 'rule_id', v_philhealth_rule_id, 'effective_from', v_philhealth_effective),
        'pagibig', jsonb_build_object('employee', round(v_pagibig_monthly_employee / v_period_divisor, 2), 'employer', round(v_pagibig_monthly_employer / v_period_divisor, 2), 'base', round(v_pagibig_base, 2), 'rule_id', v_pagibig_rule_id, 'effective_from', v_pagibig_effective),
        'withholding_tax', jsonb_build_object('employee', v_withholding, 'monthly_taxable_base', round(v_taxable_monthly, 2), 'rule_id', v_tax_rule_id, 'effective_from', v_tax_effective)
      )
    );
    created_at := now();
    return next;
  end loop;
end;
$$;

revoke all on function public.pms_preview_payroll(uuid) from public;
grant execute on function public.pms_preview_payroll(uuid) to authenticated;

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
  lock_row record;
begin
  if not public.pms_is_admin() then raise exception 'Administrator access is required'; end if;
  select * into period_row from public.pms_payroll_periods where id = p_payroll_period_id for update;
  if period_row.id is null then raise exception 'Payroll period not found'; end if;
  if period_row.status in ('paid', 'cancelled') then raise exception 'This payroll period cannot be finalized'; end if;
  select * into run_row from public.pms_payroll_finalization_runs where payroll_period_id = p_payroll_period_id;
  if run_row.id is not null then
    return query select * from public.pms_payroll_records where payroll_period_id = p_payroll_period_id order by employee_id;
    return;
  end if;
  if exists (select 1 from public.pms_payroll_finalization_runs where idempotency_key = p_idempotency_key) then
    raise exception 'The finalization key has already been used for another payroll period';
  end if;

  for lock_row in select employee.id from public.pms_employees employee where employee.status = 'active' order by employee.id for update loop null; end loop;
  for lock_row in select salary.id from public.pms_employee_salary_history salary where exists (select 1 from public.pms_employees employee where employee.id = salary.employee_id and employee.status = 'active') and salary.effective_from <= period_row.end_date and (salary.effective_to is null or salary.effective_to >= period_row.start_date) order by salary.employee_id, salary.effective_from desc, salary.id for update loop null; end loop;
  for lock_row in select attendance.id from public.pms_employee_attendance attendance where attendance.payroll_period_id = p_payroll_period_id order by attendance.id for update loop null; end loop;
  for lock_row in select income.id from public.pms_other_income income where income.payroll_period_id = p_payroll_period_id order by income.id for update loop null; end loop;
  for lock_row in select deduction.id from public.pms_other_deductions deduction where deduction.payroll_period_id = p_payroll_period_id order by deduction.id for update loop null; end loop;
  for lock_row in select loan.id from public.pms_employee_loans loan where loan.status = 'active' and exists (select 1 from public.pms_employees employee where employee.id = loan.employee_id and employee.status = 'active') order by loan.id for update loop null; end loop;

  update public.pms_payroll_periods set status = 'processing' where id = p_payroll_period_id;
  for preview_row in select * from public.pms_preview_payroll(p_payroll_period_id) loop
    insert into public.pms_payroll_records (
      id, payroll_period_id, employee_id, salary_type, base_pay, attendance_deductions, basic_pay, overtime_pay,
      other_income, gross_pay, employee_contributions, employer_contributions, withholding_tax, loan_deductions,
      other_deductions, total_deductions, net_pay, calculation_version, calculation_snapshot, created_at
    ) values (
      preview_row.id, preview_row.payroll_period_id, preview_row.employee_id, preview_row.salary_type,
      preview_row.base_pay, preview_row.attendance_deductions, preview_row.basic_pay, preview_row.overtime_pay,
      preview_row.other_income, preview_row.gross_pay, preview_row.employee_contributions, preview_row.employer_contributions,
      preview_row.withholding_tax, preview_row.loan_deductions, preview_row.other_deductions, preview_row.total_deductions,
      preview_row.net_pay, preview_row.calculation_version, preview_row.calculation_snapshot, preview_row.created_at
    );
    insert into public.pms_payroll_record_items (payroll_record_id, item_type, code, label, amount, metadata)
    values
      (preview_row.id, 'earning', 'BASIC_PAY', 'Basic pay after attendance', preview_row.basic_pay, jsonb_build_object('base_pay', preview_row.base_pay, 'attendance_deductions', preview_row.attendance_deductions)),
      (preview_row.id, 'earning', 'OVERTIME', 'Overtime pay', preview_row.overtime_pay, jsonb_build_object('hours', preview_row.overtime_hours, 'hourly_rate', preview_row.hourly_rate)),
      (preview_row.id, 'contribution', 'SSS_EE', 'SSS employee contribution', coalesce((preview_row.calculation_snapshot #>> '{statutory,sss,employee}')::numeric, 0), jsonb_build_object('side', 'employee')),
      (preview_row.id, 'contribution', 'PHILHEALTH_EE', 'PhilHealth employee contribution', coalesce((preview_row.calculation_snapshot #>> '{statutory,philhealth,employee}')::numeric, 0), jsonb_build_object('side', 'employee')),
      (preview_row.id, 'contribution', 'PAGIBIG_EE', 'Pag-IBIG employee contribution', coalesce((preview_row.calculation_snapshot #>> '{statutory,pagibig,employee}')::numeric, 0), jsonb_build_object('side', 'employee')),
      (preview_row.id, 'contribution', 'SSS_ER', 'SSS employer contribution', coalesce((preview_row.calculation_snapshot #>> '{statutory,sss,employer}')::numeric, 0), jsonb_build_object('side', 'employer')),
      (preview_row.id, 'contribution', 'PHILHEALTH_ER', 'PhilHealth employer contribution', coalesce((preview_row.calculation_snapshot #>> '{statutory,philhealth,employer}')::numeric, 0), jsonb_build_object('side', 'employer')),
      (preview_row.id, 'contribution', 'PAGIBIG_ER', 'Pag-IBIG employer contribution', coalesce((preview_row.calculation_snapshot #>> '{statutory,pagibig,employer}')::numeric, 0), jsonb_build_object('side', 'employer')),
      (preview_row.id, 'tax', 'WITHHOLDING_TAX', 'Withholding tax', preview_row.withholding_tax, '{}'::jsonb),
      (preview_row.id, 'loan', 'LOAN_DEDUCTIONS', 'Loan deductions', preview_row.loan_deductions, '{}'::jsonb);
    if preview_row.attendance_deductions > 0 then
      insert into public.pms_payroll_record_items (payroll_record_id, item_type, code, label, amount, metadata)
      values (preview_row.id, 'deduction', 'ATTENDANCE_ADJUSTMENT', 'Attendance adjustment included in basic pay', preview_row.attendance_deductions, jsonb_build_object('days_worked', preview_row.attendance_days_worked, 'absence_days', preview_row.absence_days, 'tardiness_minutes', preview_row.tardiness_minutes, 'undertime_minutes', preview_row.undertime_minutes));
    end if;
    insert into public.pms_payroll_record_items (payroll_record_id, item_type, code, label, amount, metadata)
      select preview_row.id, 'earning', 'INCOME_' || upper(regexp_replace(transaction_type, '[^A-Za-z0-9]+', '_', 'g')), transaction_type, amount, jsonb_build_object('description', description)
        from public.pms_other_income where payroll_period_id = p_payroll_period_id and employee_id = preview_row.employee_id and status = 'approved';
    insert into public.pms_payroll_record_items (payroll_record_id, item_type, code, label, amount, metadata)
      select preview_row.id, 'deduction', 'DEDUCTION_' || upper(regexp_replace(transaction_type, '[^A-Za-z0-9]+', '_', 'g')), transaction_type, amount, jsonb_build_object('description', description)
        from public.pms_other_deductions where payroll_period_id = p_payroll_period_id and employee_id = preview_row.employee_id and status = 'approved';
    insert into public.pms_payroll_record_items (payroll_record_id, item_type, code, label, amount, metadata)
      select preview_row.id, 'loan', 'LOAN_' || loan.id::text, loan_type.name, least(loan.installment_amount, loan.outstanding_balance), jsonb_build_object('loan_id', loan.id)
        from public.pms_employee_loans loan join public.pms_loan_types loan_type on loan_type.id = loan.loan_type_id
       where loan.employee_id = preview_row.employee_id and loan.status = 'active' and loan.priority is not null and loan.outstanding_balance > 0;
    insert into public.pms_loan_repayments (employee_loan_id, payroll_record_id, amount)
      select loan.id, preview_row.id, least(loan.installment_amount, loan.outstanding_balance)
        from public.pms_employee_loans loan
       where loan.employee_id = preview_row.employee_id and loan.status = 'active' and loan.priority is not null and loan.outstanding_balance > 0;
    update public.pms_employee_loans loan set
      outstanding_balance = greatest(0, loan.outstanding_balance - least(loan.installment_amount, loan.outstanding_balance)),
      status = case when loan.outstanding_balance - least(loan.installment_amount, loan.outstanding_balance) <= 0 then 'completed' else 'active' end
     where loan.employee_id = preview_row.employee_id and loan.status = 'active' and loan.priority is not null and loan.outstanding_balance > 0;
  end loop;
  insert into public.pms_employee_payslips (employee_id, payroll_record_id)
    select employee_id, id from public.pms_payroll_records where payroll_period_id = p_payroll_period_id on conflict (payroll_record_id) do nothing;
  insert into public.pms_payroll_finalization_runs (payroll_period_id, idempotency_key, finalized_by) values (p_payroll_period_id, p_idempotency_key, auth.uid());
  update public.pms_payroll_periods set status = 'finalized', finalized_at = now() where id = p_payroll_period_id;
  return query select * from public.pms_payroll_records where payroll_period_id = p_payroll_period_id order by employee_id;
end;
$$;

grant execute on function public.pms_finalize_payroll(uuid, text) to authenticated;
