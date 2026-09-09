begin;

-- Published tokens are the only columns readable through the public Data API.
create table public.theme_settings (
  id boolean primary key default true check (id),
  draft jsonb,
  published jsonb,
  revision uuid not null default gen_random_uuid()
);
insert into public.theme_settings (id) values (true);
alter table public.theme_settings enable row level security;
revoke all on public.theme_settings from public, anon, authenticated;
grant select (published) on public.theme_settings to anon, authenticated;
create policy theme_public_read on public.theme_settings
for select to anon, authenticated using (true);

create table public.theme_versions (
  id uuid primary key default gen_random_uuid(),
  tokens jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.theme_versions enable row level security;
revoke all on public.theme_versions from public, anon, authenticated;
grant select on public.theme_versions to authenticated;
create policy theme_versions_admin_read on public.theme_versions
for select to authenticated using ((select public.is_admin()));

create function private.theme_luminance(p_hex text) returns double precision
language plpgsql immutable strict set search_path = '' as $$
declare
  channels bytea := decode(substr(p_hex, 2), 'hex');
  value double precision;
  result double precision := 0;
  weights double precision[] := array[0.2126, 0.7152, 0.0722];
begin
  for i in 0..2 loop
    value := get_byte(channels, i) / 255.0;
    value := case when value <= 0.04045 then value / 12.92
      else power((value + 0.055) / 1.055, 2.4) end;
    result := result + value * weights[i + 1];
  end loop;
  return result;
end;
$$;
revoke all on function private.theme_luminance(text) from public, anon, authenticated;

create function public.get_theme_editor() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Administrative membership required' using errcode = '42501';
  end if;
  return (select jsonb_build_object('draft', draft, 'published', published, 'revision', revision)
    from public.theme_settings where id);
end;
$$;
revoke all on function public.get_theme_editor() from public, anon, authenticated;
grant execute on function public.get_theme_editor() to authenticated;

create function public.save_theme(p_tokens jsonb, p_revision uuid, p_publish boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  current_revision uuid;
  key text;
  text_light double precision;
  surface_light double precision;
begin
  if not public.is_admin() then
    raise exception 'Administrative membership required' using errcode = '42501';
  end if;
  if p_tokens is null or jsonb_typeof(p_tokens) <> 'object' or p_publish is null then
    raise exception 'Invalid theme' using errcode = '22023';
  end if;
  if (select count(*) from jsonb_object_keys(p_tokens)) <> 4 then
    raise exception 'Invalid theme keys' using errcode = '22023';
  end if;
  foreach key in array array['primary', 'background', 'text', 'surface'] loop
    if not (p_tokens ? key) or jsonb_typeof(p_tokens -> key) <> 'string'
      or (p_tokens ->> key) !~ '^#[0-9a-fA-F]{6}$' then
      raise exception 'Invalid theme color' using errcode = '22023';
    end if;
  end loop;
  -- Drafts may contain low contrast for editing; publication may not.
  if p_publish then
    text_light := private.theme_luminance(p_tokens ->> 'text');
    foreach key in array array['background', 'surface'] loop
      surface_light := private.theme_luminance(p_tokens ->> key);
      if (greatest(text_light, surface_light) + 0.05) /
         (least(text_light, surface_light) + 0.05) < 4.5 then
        raise exception 'Insufficient text contrast' using errcode = '22023';
      end if;
    end loop;
  end if;
  select revision into current_revision from public.theme_settings where id for update;
  if current_revision is distinct from p_revision or current_revision is null then
    raise exception 'Theme changed; reload before saving' using errcode = '40001';
  end if;
  update public.theme_settings set draft = p_tokens,
    published = case when p_publish then p_tokens else published end,
    revision = gen_random_uuid() where id;
  if p_publish then
    insert into public.theme_versions (tokens, created_by) values (p_tokens, auth.uid());
  end if;
  return public.get_theme_editor();
end;
$$;
revoke all on function public.save_theme(jsonb, uuid, boolean) from public, anon, authenticated;
grant execute on function public.save_theme(jsonb, uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
commit;
