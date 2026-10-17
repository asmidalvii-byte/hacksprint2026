begin;
create table public.seller_profiles (
 seller_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '', created_at timestamptz not null default now()
);
create table public.products (
 id uuid primary key, seller_id uuid not null references auth.users(id) on delete cascade,
 title text not null default '', snapshot jsonb not null,
 image_path text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (image_path is null or split_part(image_path,'/',1)=seller_id::text)
);
create index products_seller_updated on public.products(seller_id,updated_at desc);
create table public.seller_verifications (
 seller_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('identity','business','gst')),
 status text not null default 'not_started' check(status in ('not_started','pending','verified','rejected','action_required','expired')),
 provider_reference text, masked_identifier text, verified_at timestamptz, expires_at timestamptz,
 updated_at timestamptz not null default now(), primary key(seller_id,kind),
 check(status <> 'verified' or (verified_at is not null and provider_reference is not null))
);
alter table public.seller_profiles enable row level security;
alter table public.products enable row level security;
alter table public.seller_verifications enable row level security;
revoke all on public.seller_profiles,public.products,public.seller_verifications from anon,authenticated;
grant select,insert,update,delete on public.seller_profiles,public.products to authenticated;
grant select on public.seller_verifications to authenticated;
create policy profiles_select on public.seller_profiles for select to authenticated using ((select auth.uid())=seller_id);
create policy profiles_insert on public.seller_profiles for insert to authenticated with check ((select auth.uid())=seller_id);
create policy profiles_update on public.seller_profiles for update to authenticated using ((select auth.uid())=seller_id) with check ((select auth.uid())=seller_id);
create policy profiles_delete on public.seller_profiles for delete to authenticated using ((select auth.uid())=seller_id);
create policy products_select on public.products for select to authenticated using ((select auth.uid())=seller_id);
create policy products_insert on public.products for insert to authenticated with check ((select auth.uid())=seller_id);
create policy products_update on public.products for update to authenticated using ((select auth.uid())=seller_id) with check ((select auth.uid())=seller_id);
create policy products_delete on public.products for delete to authenticated using ((select auth.uid())=seller_id);
create policy verification_select on public.seller_verifications for select to authenticated using ((select auth.uid())=seller_id);
-- No seller write grants or policies for authoritative verification statuses.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('product-images','product-images',false,10485760,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy image_select on storage.objects for select to authenticated using (bucket_id='product-images' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy image_insert on storage.objects for insert to authenticated with check (bucket_id='product-images' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy image_update on storage.objects for update to authenticated using (bucket_id='product-images' and (storage.foldername(name))[1]=(select auth.uid())::text) with check (bucket_id='product-images' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy image_delete on storage.objects for delete to authenticated using (bucket_id='product-images' and (storage.foldername(name))[1]=(select auth.uid())::text);
commit;
