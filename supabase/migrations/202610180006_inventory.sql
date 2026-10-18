begin;
create unique index products_id_seller_unique on public.products(id,seller_id);
create table public.inventory_items (
 id uuid primary key default gen_random_uuid(),seller_id uuid not null references auth.users(id) on delete cascade,
 product_id uuid,name text not null check(length(trim(name)) between 1 and 150),sku text not null check(length(trim(sku)) between 1 and 80),
 category text not null check(category='saree'),quantity integer not null default 0 check(quantity between 0 and 1000000),
 low_stock_threshold integer not null default 5 check(low_stock_threshold between 0 and 1000000),
 price numeric(12,2) check(price between 0 and 10000000),currency text not null default 'INR' check(currency in ('INR','USD','GBP','EUR')),
 description text not null default '' check(length(description)<=2000),version integer not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 stock_status text generated always as (case when quantity=0 then 'out_of_stock' when quantity<=low_stock_threshold then 'low_stock' else 'in_stock' end) stored,
 foreign key(product_id,seller_id) references public.products(id,seller_id) on delete restrict
);
create unique index inventory_seller_sku on public.inventory_items(seller_id,lower(trim(sku)));
create unique index inventory_seller_product on public.inventory_items(seller_id,product_id) where product_id is not null;
create index inventory_seller_updated on public.inventory_items(seller_id,updated_at desc);
alter table public.inventory_items enable row level security;
revoke all on public.inventory_items from public,anon,authenticated;
grant select,insert,update,delete on public.inventory_items to authenticated;
create policy inventory_owner on public.inventory_items for all to authenticated
 using (seller_id=(select auth.uid()) and (select public.has_verified_business()))
 with check (seller_id=(select auth.uid()) and (select public.has_verified_business()));
create function public.inventory_revision() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='INSERT' then new.version=1;new.created_at=now();
 else new.version=old.version+1;new.created_at=old.created_at;end if;
 new.updated_at=now();return new;
end;$$;
create trigger inventory_revision before insert or update on public.inventory_items for each row execute function public.inventory_revision();
commit;
