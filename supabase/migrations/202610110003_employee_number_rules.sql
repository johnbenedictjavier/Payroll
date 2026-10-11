-- Employee numbers are assigned by PMS and are immutable after creation.

create or replace function public.pms_protect_employee_number() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.employee_number is distinct from old.employee_number then
    raise exception 'Employee number cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists pms_employee_number_immutable on public.pms_employees;
create trigger pms_employee_number_immutable
before update of employee_number on public.pms_employees
for each row execute function public.pms_protect_employee_number();
