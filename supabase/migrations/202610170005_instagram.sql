begin;
-- Server-only records. The service key must never reach clients. Every backend query also binds seller_id.
create table public.instagram_connections (
 seller_id uuid primary key references auth.users(id) on delete cascade,
 account_id text not null unique, username text not null, token_cipher text not null,
 permissions jsonb not null, expires_at timestamptz not null, updated_at timestamptz not null default now()
);
create table public.instagram_oauth_states (
 state_hash text primary key, browser_hash text not null,
 seller_id uuid not null references auth.users(id) on delete cascade, expires_at timestamptz not null
);
create table public.instagram_approvals (
 id uuid primary key, seller_id uuid not null references auth.users(id) on delete cascade,
 product_id uuid not null references public.products(id) on delete cascade,
 caption text not null, image_path text not null, image_hash text not null,
 approved_at timestamptz not null default now()
);
create table public.instagram_jobs (
 id uuid primary key, seller_id uuid not null references auth.users(id) on delete cascade,
 approval_id uuid not null unique references public.instagram_approvals(id),
 account_id text not null, state text not null check(state in ('queued','processing','publishing','published','failed')),
 container_id text, media_id text, permalink text, error_code text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.instagram_connections enable row level security;
alter table public.instagram_oauth_states enable row level security;
alter table public.instagram_approvals enable row level security;
alter table public.instagram_jobs enable row level security;
revoke all on public.instagram_connections,public.instagram_oauth_states,public.instagram_approvals,public.instagram_jobs from public,anon,authenticated;
grant all on public.instagram_connections,public.instagram_oauth_states,public.instagram_approvals,public.instagram_jobs to service_role;
-- Immutable approved images are accessible only through short-lived server-created signed URLs.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('instagram-approved','instagram-approved',false,8388608,array['image/jpeg']) on conflict(id) do nothing;
commit;
