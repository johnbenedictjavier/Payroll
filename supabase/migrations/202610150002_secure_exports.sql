-- Private bucket for short-lived administrator export documents.

insert into storage.buckets (id, name, public)
values ('pms-exports', 'pms-exports', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists pms_exports_admin_read on storage.objects;
create policy pms_exports_admin_read on storage.objects
  for select to authenticated
  using (bucket_id = 'pms-exports' and public.pms_is_admin());

drop policy if exists pms_exports_admin_write on storage.objects;
create policy pms_exports_admin_write on storage.objects
  for all to authenticated
  using (bucket_id = 'pms-exports' and public.pms_is_admin())
  with check (bucket_id = 'pms-exports' and public.pms_is_admin());
