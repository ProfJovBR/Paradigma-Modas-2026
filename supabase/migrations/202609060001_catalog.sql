begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.admin_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table private.admin_memberships enable row level security;
revoke all on private.admin_memberships from public, anon, authenticated;
-- No arguments or editable metadata: only the authenticated caller's UUID.
create function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from private.admin_memberships where user_id = (select auth.uid())); $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 1 and 100)
);
create table public.sizes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 1 and 40)
);
create table public.colors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 1 and 60),
  hex text not null check (hex ~ '^#[0-9a-fA-F]{6}$')
);
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  description text not null default '' check (length(description) <= 10000),
  price_cents integer not null check (price_cents between 1 and 100000000),
  category_id uuid references public.categories(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  size_id uuid not null references public.sizes(id) on delete restrict,
  color_id uuid not null references public.colors(id) on delete restrict,
  sku text not null unique check (length(trim(sku)) between 1 and 80),
  stock integer not null default 0 check (stock between 0 and 1000000),
  updated_at timestamptz not null default now(),
  unique (product_id, size_id, color_id)
);
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  path text not null unique,
  alt text not null default '' check (length(alt) <= 300),
  position integer not null default 0 check (position between 0 and 10000),
  check (path ~ ('^' || product_id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$'))
);
create index products_public_idx on public.products (status, created_at desc);
create index products_category_idx on public.products (category_id);
create index variants_product_idx on public.product_variants (product_id);
create index variants_size_idx on public.product_variants (size_id);
create index variants_color_idx on public.product_variants (color_id);
create index images_product_idx on public.product_images (product_id, position);
create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$ begin new.updated_at = clock_timestamp(); return new; end; $$;
create trigger products_updated before update on public.products for each row execute function private.touch_updated_at();
create trigger variants_updated before update on public.product_variants for each row execute function private.touch_updated_at();
alter table public.products enable row level security;
alter table public.categories enable row level security;
alter table public.sizes enable row level security;
alter table public.colors enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;
revoke all on public.products, public.categories, public.sizes, public.colors, public.product_variants, public.product_images from public, anon, authenticated;
grant select on public.products, public.categories, public.sizes, public.colors, public.product_variants, public.product_images to anon, authenticated;
grant insert, update, delete on public.products, public.categories, public.sizes, public.colors, public.product_variants, public.product_images to authenticated;
create policy products_public_read on public.products for select to anon, authenticated using (status = 'active');
create policy categories_public_read on public.categories for select to anon, authenticated using (exists (select 1 from public.products p where p.category_id = categories.id and p.status = 'active'));
create policy variants_public_read on public.product_variants for select to anon, authenticated using (exists (select 1 from public.products p where p.id = product_variants.product_id and p.status = 'active'));
create policy images_public_read on public.product_images for select to anon, authenticated using (exists (select 1 from public.products p where p.id = product_images.product_id and p.status = 'active'));
create policy sizes_public_read on public.sizes for select to anon, authenticated using (exists (select 1 from public.product_variants v join public.products p on p.id = v.product_id where v.size_id = sizes.id and p.status = 'active'));
create policy colors_public_read on public.colors for select to anon, authenticated using (exists (select 1 from public.product_variants v join public.products p on p.id = v.product_id where v.color_id = colors.id and p.status = 'active'));
create policy products_admin on public.products for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy categories_admin on public.categories for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy sizes_admin on public.sizes for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy colors_admin on public.colors for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy variants_admin on public.product_variants for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy images_admin on public.product_images for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
commit;
