begin;

create table public.contact_settings (
  id boolean primary key default true check (id),
  email text not null default '' check (length(email) <= 254 and (email = '' or email ~ '^[A-Za-z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$')),
  email_visible boolean not null default false,
  whatsapp text not null default '' check (whatsapp = '' or whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
  whatsapp_visible boolean not null default false,
  phone text not null default '' check (phone = '' or phone ~ '^\+[1-9][0-9]{7,14}$'),
  phone_visible boolean not null default false,
  revision uuid not null default gen_random_uuid(),
  check (not email_visible or email <> ''),
  check (not whatsapp_visible or whatsapp <> ''),
  check (not phone_visible or phone <> '')
);
insert into public.contact_settings(id) values (true);
alter table public.contact_settings enable row level security;
revoke all on public.contact_settings from public, anon, authenticated;
grant select on public.contact_settings to authenticated;
create policy contact_admin_read on public.contact_settings for select to authenticated
using ((select public.is_admin()));

-- Public read is deliberately limited to visible channels. Hidden values never
-- leave the database through this endpoint. No direct anonymous table access.
create function public.get_public_contact() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'email', case when email_visible then email else '' end, 'email_visible', email_visible,
    'whatsapp', case when whatsapp_visible then whatsapp else '' end, 'whatsapp_visible', whatsapp_visible,
    'phone', case when phone_visible then phone else '' end, 'phone_visible', phone_visible
  ) from public.contact_settings where id = true;
$$;
create function public.get_contact_editor() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  return (select to_jsonb(c) - 'id' from public.contact_settings c where id = true);
end;
$$;
create function public.save_contact_settings(p_settings jsonb, p_revision uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare current_settings public.contact_settings;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  if p_settings is null or jsonb_typeof(p_settings) <> 'object'
    or not (p_settings ?& array['email','email_visible','whatsapp','whatsapp_visible','phone','phone_visible'])
    or (p_settings - array['email','email_visible','whatsapp','whatsapp_visible','phone','phone_visible']) <> '{}'::jsonb
    or jsonb_typeof(p_settings->'email') is distinct from 'string'
    or jsonb_typeof(p_settings->'whatsapp') is distinct from 'string'
    or jsonb_typeof(p_settings->'phone') is distinct from 'string'
    or jsonb_typeof(p_settings->'email_visible') is distinct from 'boolean'
    or jsonb_typeof(p_settings->'whatsapp_visible') is distinct from 'boolean'
    or jsonb_typeof(p_settings->'phone_visible') is distinct from 'boolean' then
    raise exception 'Invalid contact settings' using errcode = '22023';
  end if;
  select * into current_settings from public.contact_settings where id = true for update;
  if current_settings.revision is distinct from p_revision then
    raise exception 'Contact settings changed; reload' using errcode = '40001';
  end if;
  update public.contact_settings set
    email = btrim(p_settings->>'email'), email_visible = (p_settings->>'email_visible')::boolean,
    whatsapp = btrim(p_settings->>'whatsapp'), whatsapp_visible = (p_settings->>'whatsapp_visible')::boolean,
    phone = btrim(p_settings->>'phone'), phone_visible = (p_settings->>'phone_visible')::boolean,
    revision = gen_random_uuid()
    where id = true returning * into current_settings;
  return to_jsonb(current_settings) - 'id';
end;
$$;
revoke all on function public.get_public_contact(), public.get_contact_editor(), public.save_contact_settings(jsonb,uuid) from public, anon, authenticated;
grant execute on function public.get_public_contact() to anon, authenticated;
grant execute on function public.get_contact_editor(), public.save_contact_settings(jsonb,uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
