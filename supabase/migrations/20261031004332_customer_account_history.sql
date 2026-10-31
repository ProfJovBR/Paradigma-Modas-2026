begin;
alter table public.orders add column customer_id uuid references auth.users(id) on delete set null;
create index orders_customer_idx on public.orders(customer_id,created_at desc);
create function private.assign_order_customer() returns trigger language plpgsql set search_path='' as $$
begin new.customer_id := auth.uid(); return new; end $$;
create trigger orders_assign_customer before insert on public.orders for each row execute function private.assign_order_customer();
revoke all on function private.assign_order_customer() from public,anon,authenticated;
create policy orders_customer_read on public.orders for select to authenticated using (customer_id=(select auth.uid()));
create policy order_items_customer_read on public.order_items for select to authenticated using (exists(select 1 from public.orders o where o.id=order_id and o.customer_id=(select auth.uid())));
create table public.product_views (
 user_id uuid not null references auth.users(id) on delete cascade,
 product_id uuid not null references public.products(id) on delete cascade,
 viewed_at timestamptz not null default now(),
 primary key(user_id,product_id)
);
create index product_views_recent_idx on public.product_views(user_id,viewed_at desc);
create index product_views_product_idx on public.product_views(product_id);
alter table public.product_views enable row level security;
revoke all on public.product_views from public,anon,authenticated;
grant select,insert,update,delete on public.product_views to authenticated;
create policy views_read on public.product_views for select to authenticated using(user_id=(select auth.uid()));
create policy views_insert on public.product_views for insert to authenticated with check(user_id=(select auth.uid()));
create policy views_update on public.product_views for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy views_delete on public.product_views for delete to authenticated using(user_id=(select auth.uid()));
create function public.record_product_view(p_product_id uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception using errcode='42501',message='Sign in required'; end if;
 if not exists(select 1 from public.products where id=p_product_id and status='active') then return; end if;
 delete from public.product_views where user_id=auth.uid() and viewed_at < now()-interval '30 days';
 insert into public.product_views(user_id,product_id,viewed_at) values(auth.uid(),p_product_id,now())
 on conflict(user_id,product_id) do update set viewed_at=now();
end $$;
revoke all on function public.record_product_view(uuid) from public,anon;
grant execute on function public.record_product_view(uuid) to authenticated;
commit;
