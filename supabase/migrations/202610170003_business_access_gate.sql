begin;
-- Invoker rights: the caller sees only their own verification records under RLS.
create or replace function public.has_verified_business() returns boolean
language sql stable security invoker set search_path = '' as $$
 select exists (
  select 1 from public.seller_verifications b
  where b.seller_id=(select auth.uid()) and b.kind='business' and b.status='verified'
   and length(trim(b.provider_reference))>0 and b.verified_at<=now()
   and (b.expires_at is null or b.expires_at>now())
 ) and exists (
  select 1 from public.seller_verifications r
  where r.seller_id=(select auth.uid()) and r.kind in ('udyam','gst') and r.status='verified'
   and length(trim(r.provider_reference))>0 and r.verified_at<=now()
   and (r.expires_at is null or r.expires_at>now())
 );
$$;
revoke all on function public.has_verified_business() from public,anon;
grant execute on function public.has_verified_business() to authenticated;
-- Restrictive policies AND with existing owner policies, preserving ownership checks.
create policy products_business_gate on public.products as restrictive for all to authenticated
 using ((select public.has_verified_business())) with check ((select public.has_verified_business()));
create policy images_business_gate on storage.objects as restrictive for all to authenticated
 using (bucket_id <> 'product-images' or (select public.has_verified_business()))
 with check (bucket_id <> 'product-images' or (select public.has_verified_business()));
-- Changing submitted business details invalidates existing approvals atomically,
-- including changes made directly through Supabase rather than through Kriti.
create or replace function public.invalidate_business_verification() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if TG_OP='INSERT' or row(new.legal_name,new.business_name,new.business_type,new.state,new.address,new.gstin,new.udyam_number,new.consent)
 is distinct from row(old.legal_name,old.business_name,old.business_type,old.state,old.address,old.gstin,old.udyam_number,old.consent) then
  update public.seller_verifications set status='action_required', verified_at=null, updated_at=now()
   where seller_id=new.seller_id and kind in ('business','udyam','gst');
 end if;
 return new;
end;
$$;
revoke all on function public.invalidate_business_verification() from public,anon,authenticated;
create trigger business_details_invalidate_verification after insert or update on public.business_details
 for each row execute function public.invalidate_business_verification();
commit;
