begin;

-- Only published references are public; upload bookkeeping stays admin-only.
create table public.banner_assets (
  path text primary key,
  slot text not null check (slot in ('hero', 'cta')),
  state text not null default 'pending' check (state in ('pending', 'active', 'retired')),
  created_at timestamptz not null default now(),
  check (path ~ ('^' || slot || '/[0-9a-f-]{36}\.(jpg|png|webp)$'))
);
create table public.site_banners (
  slot text primary key check (slot in ('hero', 'cta')),
  path text unique references public.banner_assets(path),
  alt text not null default '' check (length(alt) <= 300),
  revision uuid not null default gen_random_uuid()
);
insert into public.site_banners(slot) values ('hero'), ('cta');
alter table public.banner_assets enable row level security;
alter table public.site_banners enable row level security;
revoke all on public.banner_assets, public.site_banners from public, anon, authenticated;
grant select on public.site_banners to anon, authenticated;
grant select on public.banner_assets to authenticated;
create policy banners_read on public.site_banners for select to anon, authenticated using (true);
create policy banner_assets_admin_read on public.banner_assets for select to authenticated
using ((select public.is_admin()));

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('banners', 'banners', false, 5000000, array['image/jpeg','image/png','image/webp']);
create policy banners_storage_read on storage.objects for select to anon, authenticated
using (bucket_id = 'banners' and ((select public.is_admin()) or exists (
  select 1 from public.site_banners b where b.path = storage.objects.name
)));
create policy banners_storage_insert on storage.objects for insert to authenticated
with check (bucket_id = 'banners' and (select public.is_admin()) and exists (
  select 1 from public.banner_assets a where a.path = storage.objects.name and a.state = 'pending'
));
-- Published files cannot be deleted, even by administrators using the browser API.
create policy banners_storage_delete on storage.objects for delete to authenticated
using (bucket_id = 'banners' and (select public.is_admin()) and exists (
  select 1 from public.banner_assets a where a.path = storage.objects.name and a.state = 'retired'
));
-- No UPDATE policy: uploads always use a new UUID and upsert=false.

create function public.prepare_banner_upload(p_slot text, p_extension text) returns text
language plpgsql security definer set search_path = '' as $$
declare new_path text;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  if p_slot is null or p_slot not in ('hero','cta') or p_extension is null or p_extension not in ('jpg','png','webp') then
    raise exception 'Invalid banner upload' using errcode = '22023';
  end if;
  new_path := p_slot || '/' || gen_random_uuid()::text || '.' || p_extension;
  insert into public.banner_assets(path,slot) values (new_path,p_slot);
  return new_path;
end;
$$;

create function public.publish_banner(p_slot text, p_path text, p_alt text, p_revision uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_banner public.site_banners; asset public.banner_assets;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  if p_slot is null or p_slot not in ('hero','cta') or p_alt is null or length(p_alt) > 300 then
    raise exception 'Invalid banner' using errcode = '22023';
  end if;
  select * into current_banner from public.site_banners where slot = p_slot for update;
  if current_banner.revision is distinct from p_revision then
    raise exception 'Banner changed; reload' using errcode = '40001';
  end if;
  if p_path is not null then
    select * into asset from public.banner_assets where path = p_path for update;
    if asset.path is null or asset.slot <> p_slot or asset.state = 'retired'
      or (asset.state = 'active' and p_path is distinct from current_banner.path)
      or not exists (select 1 from storage.objects where bucket_id = 'banners' and name = p_path
        and metadata->>'mimetype' in ('image/jpeg','image/png','image/webp')
        and (metadata->>'size')::bigint between 1 and 5000000) then
      raise exception 'Upload missing or invalid' using errcode = '22023';
    end if;
  end if;
  if current_banner.path is distinct from p_path then
    update public.banner_assets set state = 'retired' where path = current_banner.path;
  end if;
  update public.banner_assets set state = 'active' where path = p_path;
  update public.site_banners set path = p_path, alt = btrim(p_alt), revision = gen_random_uuid()
    where slot = p_slot returning * into current_banner;
  return to_jsonb(current_banner);
end;
$$;

-- Safe after an ambiguous network response: never retires an active/published file.
create function public.discard_banner_upload(p_path text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  update public.banner_assets set state = 'retired' where path = p_path and state = 'pending';
end;
$$;

create function public.claim_banner_cleanup() returns setof text
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  -- Abandoned uploads remain tracked, then become ineligible for publication.
  update public.banner_assets set state = 'retired'
    where state = 'pending' and created_at < now() - interval '24 hours';
  return query select a.path from public.banner_assets a
    where a.state = 'retired' and exists (
      select 1 from storage.objects o where o.bucket_id = 'banners' and o.name = a.path
    ) order by a.created_at limit 100;
  -- Keep tombstones: a delayed upload can be found on the next cleanup pass.
  -- Actual deletion MUST use Storage API, never DELETE from storage.objects here.
end;
$$;
revoke all on function public.prepare_banner_upload(text,text), public.publish_banner(text,text,text,uuid),
  public.discard_banner_upload(text), public.claim_banner_cleanup() from public, anon, authenticated;
grant execute on function public.prepare_banner_upload(text,text), public.publish_banner(text,text,text,uuid),
  public.discard_banner_upload(text), public.claim_banner_cleanup() to authenticated;
notify pgrst, 'reload schema';
commit;
