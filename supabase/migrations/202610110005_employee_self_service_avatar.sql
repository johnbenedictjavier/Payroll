-- Allow employees to replace only their own profile avatar.

create or replace function public.pms_update_own_employee_photo(p_photo_path text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_employee_id uuid;
  previous_photo_path text;
begin
  select id, photo_path
    into current_employee_id, previous_photo_path
    from public.pms_employees
   where auth_user_id = auth.uid()
   for update;

  if current_employee_id is null then
    raise exception 'Your account is not linked to an employee record.';
  end if;

  if p_photo_path is null or p_photo_path !~ ('^' || current_employee_id::text || '/profile-[0-9a-f-]+[.](jpg|jpeg|png|webp)$') then
    raise exception 'The profile photo path is invalid.';
  end if;

  update public.pms_employees
     set photo_path = p_photo_path
   where id = current_employee_id;

  return previous_photo_path;
end;
$$;

revoke execute on function public.pms_update_own_employee_photo(text) from public;
grant execute on function public.pms_update_own_employee_photo(text) to authenticated;

drop policy if exists avatar_employee_insert_own on storage.objects;
create policy avatar_employee_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'pms-employee-avatars'
    and (storage.foldername(name))[1] = public.pms_current_employee_id()::text
  );

drop policy if exists avatar_employee_delete_own on storage.objects;
create policy avatar_employee_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'pms-employee-avatars'
    and (storage.foldername(name))[1] = public.pms_current_employee_id()::text
  );
