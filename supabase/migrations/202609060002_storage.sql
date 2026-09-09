begin;
-- Private bucket: getPublicUrl must never be used for catalog photos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalog', 'catalog', false, 5242880, array['image/jpeg','image/png','image/webp']);
create policy catalog_read on storage.objects for select to anon, authenticated
using (bucket_id = 'catalog' and ((select public.is_admin()) or exists (
  select 1 from public.product_images i join public.products p on p.id = i.product_id
  where i.path = storage.objects.name and p.status = 'active'
)));
create policy catalog_insert on storage.objects for insert to authenticated
with check (bucket_id = 'catalog' and (select public.is_admin()) and exists (
  select 1 from public.product_images i where i.path = storage.objects.name
));
create policy catalog_delete on storage.objects for delete to authenticated
using (bucket_id = 'catalog' and (select public.is_admin()));
-- No UPDATE policy: immutable UUID object names, no overwrites/upserts.
commit;
