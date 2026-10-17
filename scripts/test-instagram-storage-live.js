// Read-only real Supabase check. Never calls Meta or publishes.
import 'dotenv/config';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {sellerConfig} from '../server/sellers.js';
const c=sellerConfig();
if(!c.configured||!process.env.SUPABASE_SERVICE_ROLE_KEY||!process.env.TEST_SELLER_A_EMAIL||!process.env.TEST_SELLER_A_PASSWORD){
 console.log('NOT RUN: Supabase server key and confirmed local test account required. See docs/INSTAGRAM-BACKEND.md.');process.exitCode=2;
}else{
 try{
 const admin=createClient(c.url,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const client=createClient(c.url,c.key,{auth:{persistSession:false,autoRefreshToken:false}});
 const tables=['instagram_connections','instagram_oauth_states','instagram_approvals','instagram_jobs'];
 for(const table of tables){const r=await admin.from(table).select('*',{head:true,count:'exact'});assert.equal(r.error,null,'Migration/schema not ready');const anon=await client.from(table).select('*');assert.equal(anon.error?.code,'42501','Anonymous table access was not denied');}
 const login=await client.auth.signInWithPassword({email:process.env.TEST_SELLER_A_EMAIL,password:process.env.TEST_SELLER_A_PASSWORD});assert.equal(login.error,null,'Test sign-in failed');
 for(const table of tables){const r=await client.from(table).select('*');assert.equal(r.error?.code,'42501','Authenticated table access was not denied');}
 console.log('PASS: live Instagram table existence and anonymous/authenticated read denial. No Meta or publishing tested.');
 }catch{console.error('FAIL: Instagram storage permissions or schema check. No credentials or records logged.');process.exitCode=1}
}
