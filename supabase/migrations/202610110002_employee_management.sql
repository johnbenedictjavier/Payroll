-- Employee profile management, document retention, and first-login controls.

alter table public.pms_employees
  add column if not exists must_change_password boolean not null default true,
  add column if not exists password_changed_at timestamptz;
create table if not exists public.pms_employee_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.pms_employees(id) on delete restrict,
  storage_path text not null unique,
  original_name text not null,
  document_type text not null default 'employee-information',
  parser_version text not null default 'pms-employee-form-v1',
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists pms_employee_documents_employee_idx
  on public.pms_employee_documents (employee_id, created_at desc);
create or replace function public.pms_next_employee_number() returns text
language plpgsql security definer set search_path = public as $$
declare
  year_prefix text := to_char(current_date, 'YY') || '-';
  next_number integer;
begin
  if not public.pms_is_admin() then
    raise exception 'Administrator access is required';
  end if;

  perform pg_advisory_xact_lock(hashtext('pms_employee_number:' || year_prefix));
  select coalesce(max((substring(employee_number from '^[0-9]{2}-([0-9]{5})$'))::integer), 0) + 1
    into next_number
    from public.pms_employees
   where employee_number like year_prefix || '%';

  if next_number > 99999 then
    raise exception 'No employee numbers remain for year %', year_prefix;
  end if;

  return year_prefix || lpad(next_number::text, 5, '0');
end;
$$;
create or replace function public.pms_save_employee_profile(p_payload jsonb, p_employee_id uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  employee_data jsonb := coalesce(p_payload -> 'employee', '{}'::jsonb);
  saved_employee_id uuid := p_employee_id;
  employee_number_value text;
  first_name_value text := nullif(trim(employee_data ->> 'first_name'), '');
  last_name_value text := nullif(trim(employee_data ->> 'last_name'), '');
  assignment_item jsonb;
  assignment_id_value uuid;
  salary_item jsonb;
  salary_id_value uuid;
  current_department_id_value uuid;
  current_position_id_value uuid;
begin
  if not public.pms_is_admin() then
    raise exception 'Administrator access is required';
  end if;
  if first_name_value is null or last_name_value is null then
    raise exception 'First name and last name are required';
  end if;

  if saved_employee_id is null then
    employee_number_value := nullif(trim(employee_data ->> 'employee_number'), '');
    if employee_number_value is null then
      employee_number_value := public.pms_next_employee_number();
    end if;

    insert into public.pms_employees (
      employee_number, first_name, middle_name, last_name, gender, email,
      civil_status, nationality, religion, birth_date, permanent_address,
      present_address, contact_number, current_department_id, current_position_id,
      status, must_change_password
    ) values (
      employee_number_value,
      first_name_value,
      nullif(trim(employee_data ->> 'middle_name'), ''),
      last_name_value,
      nullif(trim(employee_data ->> 'gender'), ''),
      lower(nullif(trim(employee_data ->> 'email'), '')),
      nullif(trim(employee_data ->> 'civil_status'), ''),
      nullif(trim(employee_data ->> 'nationality'), ''),
      nullif(trim(employee_data ->> 'religion'), ''),
      nullif(employee_data ->> 'birth_date', '')::date,
      nullif(trim(employee_data ->> 'permanent_address'), ''),
      nullif(trim(employee_data ->> 'present_address'), ''),
      nullif(trim(employee_data ->> 'contact_number'), ''),
      nullif(employee_data ->> 'current_department_id', '')::uuid,
      nullif(employee_data ->> 'current_position_id', '')::uuid,
      coalesce(nullif(employee_data ->> 'status', '')::public.pms_employment_status, 'active'),
      true
    ) returning id into saved_employee_id;
  else
    update public.pms_employees set
      first_name = first_name_value,
      middle_name = nullif(trim(employee_data ->> 'middle_name'), ''),
      last_name = last_name_value,
      gender = nullif(trim(employee_data ->> 'gender'), ''),
      email = lower(nullif(trim(employee_data ->> 'email'), '')),
      civil_status = nullif(trim(employee_data ->> 'civil_status'), ''),
      nationality = nullif(trim(employee_data ->> 'nationality'), ''),
      religion = nullif(trim(employee_data ->> 'religion'), ''),
      birth_date = nullif(employee_data ->> 'birth_date', '')::date,
      permanent_address = nullif(trim(employee_data ->> 'permanent_address'), ''),
      present_address = nullif(trim(employee_data ->> 'present_address'), ''),
      contact_number = nullif(trim(employee_data ->> 'contact_number'), ''),
      current_department_id = nullif(employee_data ->> 'current_department_id', '')::uuid,
      current_position_id = nullif(employee_data ->> 'current_position_id', '')::uuid,
      status = coalesce(nullif(employee_data ->> 'status', '')::public.pms_employment_status, status)
    where id = saved_employee_id;
    if not found then
      raise exception 'Employee record not found';
    end if;
  end if;

  delete from public.pms_emergency_contacts where employee_id = saved_employee_id;
  insert into public.pms_emergency_contacts (employee_id, name, relationship, address, contact)
  select saved_employee_id,
    nullif(trim(item ->> 'name'), ''),
    nullif(trim(item ->> 'relationship'), ''),
    nullif(trim(item ->> 'address'), ''),
    nullif(trim(item ->> 'contact'), '')
  from jsonb_array_elements(coalesce(p_payload -> 'emergency_contacts', '[]'::jsonb)) item
  where nullif(trim(item ->> 'name'), '') is not null;

  delete from public.pms_dependents where employee_id = saved_employee_id;
  insert into public.pms_dependents (employee_id, name, birth_date, relationship)
  select saved_employee_id,
    nullif(trim(item ->> 'name'), ''),
    nullif(item ->> 'birth_date', '')::date,
    nullif(trim(item ->> 'relationship'), '')
  from jsonb_array_elements(coalesce(p_payload -> 'dependents', '[]'::jsonb)) item
  where nullif(trim(item ->> 'name'), '') is not null;

  delete from public.pms_educational_backgrounds where employee_id = saved_employee_id;
  insert into public.pms_educational_backgrounds (employee_id, level, school, address, school_year)
  select saved_employee_id,
    nullif(trim(item ->> 'level'), ''),
    nullif(trim(item ->> 'school'), ''),
    nullif(trim(item ->> 'address'), ''),
    nullif(trim(item ->> 'school_year'), '')
  from jsonb_array_elements(coalesce(p_payload -> 'educational_backgrounds', '[]'::jsonb)) item
  where nullif(trim(item ->> 'school'), '') is not null;

  delete from public.pms_character_references where employee_id = saved_employee_id;
  insert into public.pms_character_references (employee_id, name, occupation, address, contact)
  select saved_employee_id,
    nullif(trim(item ->> 'name'), ''),
    nullif(trim(item ->> 'occupation'), ''),
    nullif(trim(item ->> 'address'), ''),
    nullif(trim(item ->> 'contact'), '')
  from jsonb_array_elements(coalesce(p_payload -> 'character_references', '[]'::jsonb)) item
  where nullif(trim(item ->> 'name'), '') is not null;

  delete from public.pms_employee_identifiers where employee_id = saved_employee_id;
  insert into public.pms_employee_identifiers (employee_id, identifier_type, identifier_value)
  select saved_employee_id,
    nullif(trim(item ->> 'identifier_type'), ''),
    nullif(trim(item ->> 'identifier_value'), '')
  from jsonb_array_elements(coalesce(p_payload -> 'identifiers', '[]'::jsonb)) item
  where nullif(trim(item ->> 'identifier_type'), '') is not null
    and nullif(trim(item ->> 'identifier_value'), '') is not null;

  for assignment_item in
    select value from jsonb_array_elements(coalesce(p_payload -> 'assignments', '[]'::jsonb))
  loop
    assignment_id_value := nullif(assignment_item ->> 'id', '')::uuid;
    if assignment_id_value is null then
      insert into public.pms_employee_assignments (
        employee_id, department_id, position_id, start_date, end_date, is_primary
      ) values (
        saved_employee_id,
        nullif(assignment_item ->> 'department_id', '')::uuid,
        nullif(assignment_item ->> 'position_id', '')::uuid,
        coalesce(nullif(assignment_item ->> 'start_date', '')::date, current_date),
        nullif(assignment_item ->> 'end_date', '')::date,
        coalesce((assignment_item ->> 'is_primary')::boolean, false)
      );
    else
      update public.pms_employee_assignments set
        department_id = nullif(assignment_item ->> 'department_id', '')::uuid,
        position_id = nullif(assignment_item ->> 'position_id', '')::uuid,
        start_date = coalesce(nullif(assignment_item ->> 'start_date', '')::date, start_date),
        end_date = nullif(assignment_item ->> 'end_date', '')::date,
        is_primary = coalesce((assignment_item ->> 'is_primary')::boolean, is_primary)
      where id = assignment_id_value and employee_id = saved_employee_id;
    end if;
  end loop;

  for salary_item in
    select value from jsonb_array_elements(coalesce(p_payload -> 'salary_history', '[]'::jsonb))
  loop
    salary_id_value := nullif(salary_item ->> 'id', '')::uuid;
    if salary_id_value is null then
      insert into public.pms_employee_salary_history (
        employee_id, assignment_id, salary_type, amount, is_approved,
        effective_from, effective_to, source
      ) values (
        saved_employee_id,
        nullif(salary_item ->> 'assignment_id', '')::uuid,
        (salary_item ->> 'salary_type')::public.pms_salary_type,
        (salary_item ->> 'amount')::numeric,
        coalesce((salary_item ->> 'is_approved')::boolean, true),
        (salary_item ->> 'effective_from')::date,
        nullif(salary_item ->> 'effective_to', '')::date,
        nullif(trim(salary_item ->> 'source'), '')
      );
    else
      update public.pms_employee_salary_history set
        assignment_id = nullif(salary_item ->> 'assignment_id', '')::uuid,
        salary_type = (salary_item ->> 'salary_type')::public.pms_salary_type,
        amount = (salary_item ->> 'amount')::numeric,
        is_approved = coalesce((salary_item ->> 'is_approved')::boolean, is_approved),
        effective_from = coalesce(nullif(salary_item ->> 'effective_from', '')::date, effective_from),
        effective_to = nullif(salary_item ->> 'effective_to', '')::date,
        source = nullif(trim(salary_item ->> 'source'), '')
      where id = salary_id_value and employee_id = saved_employee_id;
    end if;
  end loop;

  select department_id, position_id into current_department_id_value, current_position_id_value
  from public.pms_employee_assignments
  where employee_id = saved_employee_id and is_primary = true
  order by start_date desc, created_at desc
  limit 1;

  update public.pms_employees set
    current_department_id = coalesce(current_department_id_value, current_department_id),
    current_position_id = coalesce(current_position_id_value, current_position_id)
  where id = saved_employee_id;

  return saved_employee_id;
end;
$$;
create or replace function public.pms_complete_password_change() returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.pms_employees
  set must_change_password = false, password_changed_at = now()
  where auth_user_id = auth.uid();
end;
$$;
grant execute on function public.pms_next_employee_number() to authenticated;
grant execute on function public.pms_save_employee_profile(jsonb, uuid) to authenticated;
grant execute on function public.pms_complete_password_change() to authenticated;
alter table public.pms_employee_documents enable row level security;
create policy employee_documents_admin_read on public.pms_employee_documents
  for select to authenticated using (public.pms_is_admin());
create policy employee_documents_admin_write on public.pms_employee_documents
  for all to authenticated using (public.pms_is_admin()) with check (public.pms_is_admin());
insert into storage.buckets (id, name, public)
values ('pms-employee-documents', 'pms-employee-documents', false)
on conflict (id) do update set public = excluded.public;
drop policy if exists pms_employee_documents_storage_read on storage.objects;
create policy pms_employee_documents_storage_read on storage.objects
  for select to authenticated
  using (bucket_id = 'pms-employee-documents' and public.pms_is_admin());
drop policy if exists pms_employee_documents_storage_write on storage.objects;
create policy pms_employee_documents_storage_write on storage.objects
  for all to authenticated
  using (bucket_id = 'pms-employee-documents' and public.pms_is_admin())
  with check (bucket_id = 'pms-employee-documents' and public.pms_is_admin());
