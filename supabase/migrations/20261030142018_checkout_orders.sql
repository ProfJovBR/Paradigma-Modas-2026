begin;
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity unique,
  request_key uuid not null unique,
  request_payload jsonb not null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  delivery_method text not null check (delivery_method in ('pickup','delivery')),
  address jsonb,
  notes text not null default '',
  subtotal_cents bigint not null check (subtotal_cents > 0),
  status text not null default 'pending' check (status in ('pending','confirmed','preparing','completed','cancelled')),
  revision uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null,
  sku text not null,
  size_name text not null,
  color_name text not null,
  quantity integer not null check (quantity between 1 and 99),
  unit_price_cents integer not null check (unit_price_cents > 0)
);
create index orders_created_idx on public.orders(created_at desc);
create index orders_email_idx on public.orders(customer_email,created_at);
create index orders_phone_idx on public.orders(customer_phone,created_at);
create index order_items_order_idx on public.order_items(order_id);
create index order_items_variant_idx on public.order_items(variant_id);
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
revoke all on public.orders,public.order_items from public,anon,authenticated;
grant select on public.orders,public.order_items to authenticated;
create policy orders_admin_read on public.orders for select to authenticated using ((select public.is_admin()));
create policy order_items_admin_read on public.order_items for select to authenticated using ((select public.is_admin()));

-- Guest intake is deliberately a narrow public API: no direct table writes/reads,
-- no stock reservation, no caller-supplied prices, bounded input and contact rate limit.
create function public.submit_order(p_request_key uuid, p_customer jsonb, p_delivery jsonb, p_items jsonb, p_expected_subtotal bigint, p_notes text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := trim(p_customer->>'name');
  v_email text := lower(trim(p_customer->>'email'));
  v_phone text := regexp_replace(p_customer->>'phone','[^0-9]','','g');
  v_method text := p_delivery->>'method';
  v_address jsonb := p_delivery->'address';
  v_payload jsonb;
  v_order public.orders;
  v_item jsonb;
  v_row record;
  v_total bigint := 0;
  v_qty integer;
  v_count integer := 0;
begin
  if p_request_key is null or p_customer is null or jsonb_typeof(p_customer) <> 'object'
    or p_delivery is null or jsonb_typeof(p_delivery) <> 'object'
    or p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) not between 1 and 50
    or coalesce(length(v_name),0) not between 2 and 160
    or coalesce(length(v_email),0) not between 5 and 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or coalesce(length(v_phone),0) not between 10 and 13
    or v_method is null or v_method not in ('pickup','delivery')
    or length(coalesce(p_notes,'')) > 1000 or p_expected_subtotal is null then
    raise exception using errcode='P0001',message='INVALID_ORDER';
  end if;
  if v_method='delivery' then
    if v_address is null or jsonb_typeof(v_address) <> 'object' or octet_length(v_address::text)>3000
      or coalesce(v_address->>'cep','') !~ '^[0-9]{8}$'
      or coalesce(length(trim(v_address->>'street')),0) not between 2 and 160
      or coalesce(length(trim(v_address->>'number')),0) not between 1 and 20
      or coalesce(length(trim(v_address->>'district')),0) not between 2 and 100
      or coalesce(length(trim(v_address->>'city')),0) not between 2 and 100
      or coalesce(v_address->>'state','') !~ '^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$'
      or coalesce(length(v_address->>'complement'),0)>160 then
      raise exception using errcode='P0001',message='INVALID_ADDRESS';
    end if;
  else v_address := null;
  end if;
  v_payload := jsonb_build_object('customer',jsonb_build_object('name',v_name,'email',v_email,'phone',v_phone),'delivery',jsonb_build_object('method',v_method,'address',v_address),'items',p_items,'subtotal',p_expected_subtotal,'notes',coalesce(p_notes,''));
  perform pg_advisory_xact_lock(hashtextextended(p_request_key::text,0));
  select * into v_order from public.orders where request_key=p_request_key;
  if found then
    if v_order.request_payload <> v_payload then raise exception using errcode='P0001',message='REQUEST_CONFLICT'; end if;
    return jsonb_build_object('number',v_order.number,'subtotal_cents',v_order.subtotal_cents);
  end if;
  -- Serialize submissions sharing either contact to make the limit concurrent-safe.
  perform pg_advisory_xact_lock(hashtextextended(v_email,1));
  perform pg_advisory_xact_lock(hashtextextended(v_phone,2));
  if (select count(*) from public.orders where created_at>now()-interval '10 minutes' and (customer_email=v_email or customer_phone=v_phone)) >= 3 then
    raise exception using errcode='P0001',message='RATE_LIMIT';
  end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item)<>'object' or coalesce(v_item->>'variant_id','') !~ '^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$'
      or coalesce(v_item->>'quantity','') !~ '^[0-9]{1,2}$' or (v_item->>'quantity')::integer not between 1 and 99 then
      raise exception using errcode='P0001',message='INVALID_ITEMS';
    end if;
  end loop;
  if (select count(distinct (value->>'variant_id')::uuid) from jsonb_array_elements(p_items)) <> jsonb_array_length(p_items) then
    raise exception using errcode='P0001',message='INVALID_ITEMS';
  end if;
  -- Lock consistently so catalog prices cannot change between calculation and snapshot.
  for v_row in select v.id,v.stock,p.price_cents,p.status from public.product_variants v join public.products p on p.id=v.product_id
    where v.id in (select (value->>'variant_id')::uuid from jsonb_array_elements(p_items)) order by v.id for share of v,p loop
    select (value->>'quantity')::integer into v_qty from jsonb_array_elements(p_items) where (value->>'variant_id')::uuid=v_row.id;
    if v_row.status <> 'active' or v_row.stock < v_qty then raise exception using errcode='P0001',message='STOCK_UNAVAILABLE'; end if;
    v_count:=v_count+1; v_total:=v_total+v_row.price_cents::bigint*v_qty;
  end loop;
  if v_count <> jsonb_array_length(p_items) then raise exception using errcode='P0001',message='STOCK_UNAVAILABLE'; end if;
  if v_total <> p_expected_subtotal then raise exception using errcode='P0001',message='PRICE_CHANGED'; end if;
  insert into public.orders(request_key,request_payload,customer_name,customer_email,customer_phone,delivery_method,address,notes,subtotal_cents)
    values(p_request_key,v_payload,v_name,v_email,v_phone,v_method,v_address,coalesce(p_notes,''),v_total) returning * into v_order;
  insert into public.order_items(order_id,variant_id,product_name,sku,size_name,color_name,quantity,unit_price_cents)
    select v_order.id,v.id,p.name,v.sku,s.name,c.name,(j.value->>'quantity')::integer,p.price_cents
    from jsonb_array_elements(p_items) j join public.product_variants v on v.id=(j.value->>'variant_id')::uuid
    join public.products p on p.id=v.product_id join public.sizes s on s.id=v.size_id join public.colors c on c.id=v.color_id;
  return jsonb_build_object('number',v_order.number,'subtotal_cents',v_total);
end; $$;
revoke all on function public.submit_order(uuid,jsonb,jsonb,jsonb,bigint,text) from public;
grant execute on function public.submit_order(uuid,jsonb,jsonb,jsonb,bigint,text) to anon,authenticated;

create function public.set_order_status(p_id uuid,p_revision uuid,p_status text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_order public.orders; v_item record; v_stock integer;
begin
  if auth.uid() is null or not public.is_admin() then raise exception using errcode='42501',message='Admin required'; end if;
  select * into v_order from public.orders where id=p_id for update;
  if not found then raise exception using errcode='P0001',message='ORDER_NOT_FOUND'; end if;
  if p_revision is distinct from v_order.revision then raise exception using errcode='40001',message='ORDER_CHANGED'; end if;
  if p_status is null or not ((v_order.status='pending' and p_status in ('confirmed','cancelled')) or (v_order.status='confirmed' and p_status in ('preparing','completed','cancelled')) or (v_order.status='preparing' and p_status in ('completed','cancelled'))) then
    raise exception using errcode='P0001',message='INVALID_TRANSITION';
  end if;
  if p_status='confirmed' then
    for v_item in select * from public.order_items where order_id=p_id order by variant_id loop
      select v.stock into v_stock from public.product_variants v join public.products p on p.id=v.product_id where v.id=v_item.variant_id and p.status='active' for update of v;
      if not found or v_stock<v_item.quantity then raise exception using errcode='P0001',message='STOCK_UNAVAILABLE'; end if;
      update public.product_variants set stock=stock-v_item.quantity where id=v_item.variant_id;
    end loop;
  elsif p_status='cancelled' and v_order.status in ('confirmed','preparing') then
    for v_item in select * from public.order_items where order_id=p_id order by variant_id loop
      if v_item.variant_id is not null then update public.product_variants set stock=stock+v_item.quantity where id=v_item.variant_id; end if;
    end loop;
  end if;
  update public.orders set status=p_status,revision=gen_random_uuid(),updated_at=clock_timestamp() where id=p_id returning * into v_order;
  return jsonb_build_object('status',v_order.status,'revision',v_order.revision);
end; $$;
revoke all on function public.set_order_status(uuid,uuid,text) from public,anon;
grant execute on function public.set_order_status(uuid,uuid,text) to authenticated;
commit;
