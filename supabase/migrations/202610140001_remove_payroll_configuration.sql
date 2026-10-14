-- Replace configurable policy and statutory inputs with the standard payroll rules.
-- Existing payroll records and configuration history are preserved.

create or replace function public.pms_preview_payroll(p_payroll_period_id uuid)
returns table (
  id uuid,
  payroll_period_id uuid,
  employee_id uuid,
  salary_type public.pms_salary_type,
  basic_pay numeric,
  overtime_pay numeric,
  other_income numeric,
  gross_pay numeric,
  employee_contributions numeric,
  withholding_tax numeric,
  loan_deductions numeric,
  other_deductions numeric,
  total_deductions numeric,
  net_pay numeric,
  calculation_version text,
  calculation_snapshot jsonb,
  created_at timestamptz
)
language plpgsql security definer set search_path = public as $$
declare
  period_row public.pms_payroll_periods;
  employee_row public.pms_employees;
  salary_row public.pms_employee_salary_history;
  attendance_row public.pms_employee_attendance;
  basic numeric;
  hourly numeric;
  overtime numeric;
  income_total numeric;
  contribution_total numeric;
  tax_total numeric;
  loan_total numeric;
  deduction_total numeric;
  gross numeric;
  total numeric;
  net numeric;
  work_days_per_period constant numeric := 26;
  hours_per_day constant numeric := 8;
  overtime_multiplier constant numeric := 1.25;
begin
  if not public.pms_is_admin() then raise exception 'Administrator access is required'; end if;
  select period.* into period_row
    from public.pms_payroll_periods as period
   where period.id = p_payroll_period_id;
  if period_row.id is null then raise exception 'Payroll period not found'; end if;
  if period_row.status in ('finalized', 'paid', 'cancelled') then raise exception 'This payroll period cannot be previewed'; end if;

  for employee_row in
    select employee.*
      from public.pms_employees as employee
     where employee.status = 'active'
     order by employee.last_name, employee.first_name
  loop
    select salary.* into salary_row
      from public.pms_employee_salary_history as salary
     where salary.employee_id = employee_row.id
       and salary.is_approved = true
       and salary.effective_from <= period_row.end_date
       and (salary.effective_to is null or salary.effective_to >= period_row.start_date)
     order by salary.effective_from desc
     limit 1;
    if salary_row.id is null then raise exception 'No effective salary configuration for employee %', employee_row.employee_number; end if;

    select attendance.* into attendance_row
      from public.pms_employee_attendance as attendance
     where attendance.employee_id = employee_row.id
       and attendance.payroll_period_id = p_payroll_period_id;
    if attendance_row.id is null then raise exception 'Missing attendance record for employee %', employee_row.employee_number; end if;
    if exists (
      select 1
        from public.pms_employee_loans as loan
       where loan.employee_id = employee_row.id
         and loan.status = 'active'
         and loan.priority is null
    ) then raise exception 'An active loan without administrator priority exists for employee %', employee_row.employee_number; end if;

    hourly := case
      when salary_row.salary_type = 'hourly' then salary_row.amount
      when salary_row.salary_type = 'daily' then salary_row.amount / hours_per_day
      when salary_row.salary_type = 'monthly' then salary_row.amount / work_days_per_period / hours_per_day
      else 0
    end;
    basic := case
      when salary_row.salary_type = 'monthly' then greatest(
        0,
        salary_row.amount
          - (attendance_row.absence_days * salary_row.amount / work_days_per_period)
          - (attendance_row.tardiness_minutes * hourly / 60)
          - (attendance_row.undertime_minutes * hourly / 60)
      )
      when salary_row.salary_type = 'daily' then salary_row.amount * attendance_row.days_worked
      else salary_row.amount * attendance_row.days_worked * hours_per_day
    end;
    overtime := attendance_row.overtime_hours * hourly * overtime_multiplier;

    select coalesce(sum(income.amount), 0) into income_total
      from public.pms_other_income as income
     where income.employee_id = employee_row.id
       and income.payroll_period_id = p_payroll_period_id
       and income.status = 'approved';
    select coalesce(sum(deduction.amount), 0) into deduction_total
      from public.pms_other_deductions as deduction
     where deduction.employee_id = employee_row.id
       and deduction.payroll_period_id = p_payroll_period_id
       and deduction.status = 'approved';
    select coalesce(sum(least(loan.installment_amount, loan.outstanding_balance)), 0) into loan_total
      from public.pms_employee_loans as loan
     where loan.employee_id = employee_row.id
       and loan.status = 'active'
       and loan.priority is not null;

    gross := round(basic + overtime + income_total, 2);
    contribution_total := 0;
    tax_total := 0;
    total := round(contribution_total, 2) + round(tax_total, 2) + round(loan_total, 2) + round(deduction_total, 2);
    net := round(gross - total, 2);
    if net < 0 then raise exception 'Net pay would be negative for employee %', employee_row.employee_number; end if;

    id := gen_random_uuid();
    payroll_period_id := p_payroll_period_id;
    employee_id := employee_row.id;
    salary_type := salary_row.salary_type;
    basic_pay := round(basic, 2);
    overtime_pay := round(overtime, 2);
    other_income := round(income_total, 2);
    gross_pay := gross;
    employee_contributions := round(contribution_total, 2);
    withholding_tax := round(tax_total, 2);
    loan_deductions := round(loan_total, 2);
    other_deductions := round(deduction_total, 2);
    total_deductions := total;
    net_pay := net;
    calculation_version := 'payroll-v2-fixed-defaults';
    calculation_snapshot := jsonb_build_object(
      'salary_id', salary_row.id,
      'attendance_id', attendance_row.id,
      'period_id', period_row.id,
      'work_days_per_period', work_days_per_period,
      'hours_per_day', hours_per_day,
      'overtime_multiplier', overtime_multiplier,
      'statutory_deductions_applied', false
    );
    created_at := now();
    return next;
  end loop;
end;
$$;

drop function if exists public.pms_calculate_schedule_amount(text, numeric, date);

drop policy if exists policies_read_authenticated on public.pms_payroll_policies;
drop policy if exists policies_admin_write on public.pms_payroll_policies;
drop policy if exists statutory_read_authenticated on public.pms_statutory_rate_schedules;
drop policy if exists statutory_admin_write on public.pms_statutory_rate_schedules;

alter table if exists public.pms_payroll_policies rename to pms_legacy_payroll_policies;
alter table if exists public.pms_statutory_rate_schedules rename to pms_legacy_statutory_rate_schedules;
