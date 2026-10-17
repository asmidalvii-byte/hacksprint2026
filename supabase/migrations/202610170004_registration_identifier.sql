begin;
-- FORMAT-ONLY registration gate. This never creates verification evidence.
-- Applies to every newly inserted Auth user, including direct signup API calls.
create or replace function public.require_business_registration_id()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
 kind text := new.raw_user_meta_data ->> 'business_id_type';
 identifier text := upper(trim(new.raw_user_meta_data ->> 'business_id'));
begin
 if new.raw_user_meta_data -> 'business_id_consent' is distinct from 'true'::jsonb
 or not coalesce(
  (kind='gst' and identifier ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$')
  or (kind='udyam' and identifier ~ '^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$'),false)
 then raise exception 'A correctly formatted GSTIN or Udyam ID and consent are required.' using errcode='23514';
 end if;
 new.raw_user_meta_data := jsonb_set(new.raw_user_meta_data,'{business_id}',to_jsonb(identifier));
 return new;
end;
$$;
revoke all on function public.require_business_registration_id() from public,anon,authenticated;
create trigger kriti_require_business_registration_id before insert on auth.users
for each row execute function public.require_business_registration_id();
commit;
