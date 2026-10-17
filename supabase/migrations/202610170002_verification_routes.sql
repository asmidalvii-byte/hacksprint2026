begin;

alter table public.seller_verifications drop constraint if exists seller_verifications_kind_check;
alter table public.seller_verifications add constraint seller_verifications_kind_check
  check(kind in ('identity','business','gst','udyam','authority'));
alter table public.seller_verifications drop constraint if exists seller_verifications_status_check;
alter table public.seller_verifications add constraint seller_verifications_status_check
  check(status in ('not_started','in_progress','pending_review','verified','action_required','rejected','failed','setup_required','expired','not_applicable'));

create table if not exists public.business_details (
 seller_id uuid primary key references auth.users(id) on delete cascade,
 legal_name text not null default '', business_name text not null default '',
 business_type text not null default '', state text not null default '', address text not null default '',
 gstin text, udyam_number text, consent boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.business_details enable row level security;
revoke all on public.business_details from anon, authenticated;
grant select,insert,update on public.business_details to authenticated;
create policy business_details_select on public.business_details for select to authenticated using ((select auth.uid())=seller_id);
create policy business_details_insert on public.business_details for insert to authenticated with check ((select auth.uid())=seller_id);
create policy business_details_update on public.business_details for update to authenticated using ((select auth.uid())=seller_id) with check ((select auth.uid())=seller_id);

create table if not exists public.verification_events (
 id bigint generated always as identity primary key,
 seller_id uuid not null references auth.users(id) on delete cascade,
 kind text not null, status text not null, method text not null,
 provider_reference text, reason text, created_at timestamptz not null default now()
);
create index if not exists verification_events_seller_created on public.verification_events(seller_id,created_at desc);
alter table public.verification_events enable row level security;
revoke all on public.verification_events from anon, authenticated;
grant select on public.verification_events to authenticated;
create policy verification_events_select on public.verification_events for select to authenticated using ((select auth.uid())=seller_id);

commit;
