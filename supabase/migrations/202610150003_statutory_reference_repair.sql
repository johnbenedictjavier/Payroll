-- Repair the informational statutory reference register without changing payroll calculations.

create table if not exists public.pms_statutory_reference_schedules (
  id uuid primary key default gen_random_uuid(),
  schedule_type text not null check (schedule_type in ('sss', 'philhealth', 'pagibig', 'withholding_tax')),
  effective_from date not null,
  source_reference text not null,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schedule_type),
  constraint statutory_reference_source_nonempty check (length(regexp_replace(source_reference, '^[[:space:]]+|[[:space:]]+$', '', 'g')) > 0),
  constraint statutory_reference_source_url_valid check (source_url is null or source_url ~* '^https?://[^[:space:]/?#]+([^[:space:]]*)$')
);

delete from public.pms_statutory_reference_schedules
 where source_reference is null or length(regexp_replace(source_reference, '^[[:space:]]+|[[:space:]]+$', '', 'g')) = 0;

update public.pms_statutory_reference_schedules
   set source_reference = regexp_replace(source_reference, '^[[:space:]]+|[[:space:]]+$', '', 'g'),
       source_url = case
         when nullif(regexp_replace(source_url, '^[[:space:]]+|[[:space:]]+$', '', 'g'), '') is not null
          and regexp_replace(source_url, '^[[:space:]]+|[[:space:]]+$', '', 'g') ~* '^https?://[^[:space:]/?#]+([^[:space:]]*)$'
         then regexp_replace(source_url, '^[[:space:]]+|[[:space:]]+$', '', 'g')
         else null
       end;

alter table public.pms_statutory_reference_schedules
  alter column source_reference set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.pms_statutory_reference_schedules'::regclass
       and conname = 'statutory_reference_source_nonempty'
  ) then
    alter table public.pms_statutory_reference_schedules
      add constraint statutory_reference_source_nonempty check (length(regexp_replace(source_reference, '^[[:space:]]+|[[:space:]]+$', '', 'g')) > 0);
  end if;
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.pms_statutory_reference_schedules'::regclass
       and conname = 'statutory_reference_source_url_valid'
  ) then
    alter table public.pms_statutory_reference_schedules
      add constraint statutory_reference_source_url_valid check (source_url is null or source_url ~* '^https?://[^[:space:]/?#]+([^[:space:]]*)$');
  end if;
end;
$$;

drop trigger if exists pms_statutory_reference_schedules_updated_at on public.pms_statutory_reference_schedules;
create trigger pms_statutory_reference_schedules_updated_at
before update on public.pms_statutory_reference_schedules
for each row execute function public.pms_set_updated_at();

alter table public.pms_statutory_reference_schedules enable row level security;

drop policy if exists statutory_reference_admin_read on public.pms_statutory_reference_schedules;
create policy statutory_reference_admin_read on public.pms_statutory_reference_schedules
  for select to authenticated using (public.pms_is_admin());

drop policy if exists statutory_reference_admin_insert on public.pms_statutory_reference_schedules;
create policy statutory_reference_admin_insert on public.pms_statutory_reference_schedules
  for insert to authenticated with check (public.pms_is_admin());

drop policy if exists statutory_reference_admin_update on public.pms_statutory_reference_schedules;
create policy statutory_reference_admin_update on public.pms_statutory_reference_schedules
  for update to authenticated using (public.pms_is_admin()) with check (public.pms_is_admin());

drop policy if exists statutory_reference_admin_delete on public.pms_statutory_reference_schedules;
create policy statutory_reference_admin_delete on public.pms_statutory_reference_schedules
  for delete to authenticated using (public.pms_is_admin());

do $$
declare
  source_table text;
begin
  if to_regclass('public.pms_legacy_statutory_rate_schedules') is not null then
    source_table := 'pms_legacy_statutory_rate_schedules';
  elsif to_regclass('public.pms_statutory_rate_schedules') is not null then
    source_table := 'pms_statutory_rate_schedules';
  end if;

  if source_table is not null then
    execute format($migration$
      insert into public.pms_statutory_reference_schedules (
        schedule_type, effective_from, source_reference, source_url
      )
      select schedule_type,
        effective_from,
         regexp_replace(source_reference, '^[[:space:]]+|[[:space:]]+$', '', 'g'),
         case
           when nullif(regexp_replace(source_url, '^[[:space:]]+|[[:space:]]+$', '', 'g'), '') is not null
            and regexp_replace(source_url, '^[[:space:]]+|[[:space:]]+$', '', 'g') ~* '^https?://[^[:space:]/?#]+([^[:space:]]*)$'
           then regexp_replace(source_url, '^[[:space:]]+|[[:space:]]+$', '', 'g')
           else null
        end
        from (
          select distinct on (schedule_type)
            schedule_type, effective_from, source_reference, source_url
            from public.%I
         where schedule_type in ('sss', 'philhealth', 'pagibig', 'withholding_tax')
              and nullif(regexp_replace(source_reference, '^[[:space:]]+|[[:space:]]+$', '', 'g'), '') is not null
            order by schedule_type, effective_from desc, updated_at desc
        ) legacy_reference
      on conflict (schedule_type) do nothing
    $migration$, source_table);
  end if;
end;
$$;

create or replace function public.pms_statutory_status()
returns table (
  schedule_type text,
  status text,
  effective_from date,
  source_reference text,
  source_url text
)
language sql
stable
security definer
set search_path = public
as $$
  with required_types(schedule_type) as (
    values ('sss'::text), ('philhealth'::text), ('pagibig'::text), ('withholding_tax'::text)
  )
  select required_types.schedule_type,
    case when reference_row.id is null then 'NEEDED' else 'RECORDED' end,
    reference_row.effective_from,
    reference_row.source_reference,
    reference_row.source_url
  from required_types
  left join public.pms_statutory_reference_schedules reference_row
    on reference_row.schedule_type = required_types.schedule_type
  where public.pms_is_admin()
  order by case required_types.schedule_type
    when 'sss' then 1
    when 'philhealth' then 2
    when 'pagibig' then 3
    else 4
  end;
$$;

create or replace function public.pms_upsert_statutory_reference(
  p_schedule_type text,
  p_effective_from date,
  p_source_reference text,
  p_source_url text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  reference_row public.pms_statutory_reference_schedules;
  normalized_reference text := nullif(regexp_replace(p_source_reference, '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
  normalized_url text := nullif(regexp_replace(p_source_url, '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
begin
  if not public.pms_is_admin() then
    raise exception 'Administrator access is required';
  end if;
  if p_schedule_type is null or p_schedule_type not in ('sss', 'philhealth', 'pagibig', 'withholding_tax') then
    raise exception 'Invalid statutory reference type';
  end if;
  if p_effective_from is null then
    raise exception 'An effective date is required';
  end if;
  if normalized_reference is null then
    raise exception 'A source reference is required';
  end if;
  if normalized_url is not null and normalized_url !~* '^https?://[^[:space:]/?#]+([^[:space:]]*)$' then
    raise exception 'Source URL must begin with http:// or https://';
  end if;

  insert into public.pms_statutory_reference_schedules (
    schedule_type, effective_from, source_reference, source_url
  ) values (
    p_schedule_type, p_effective_from, normalized_reference, normalized_url
  )
  on conflict (schedule_type) do update set
    effective_from = excluded.effective_from,
    source_reference = excluded.source_reference,
    source_url = excluded.source_url,
    updated_at = now()
  returning * into reference_row;

  return to_jsonb(reference_row);
end;
$$;

create or replace function public.pms_delete_statutory_reference(p_schedule_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.pms_is_admin() then
    raise exception 'Administrator access is required';
  end if;
  if p_schedule_type is null or p_schedule_type not in ('sss', 'philhealth', 'pagibig', 'withholding_tax') then
    raise exception 'Invalid statutory reference type';
  end if;
  delete from public.pms_statutory_reference_schedules
   where schedule_type = p_schedule_type;
end;
$$;

grant execute on function public.pms_statutory_status() to authenticated;
grant execute on function public.pms_upsert_statutory_reference(text, date, text, text) to authenticated;
grant execute on function public.pms_delete_statutory_reference(text) to authenticated;
