// Negative RLS check only; requires an existing unverified test account.
import 'dotenv/config';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {sellerConfig} from '../server/sellers.js';
const config=sellerConfig();
if(!config.configured||!process.env.TEST_SELLER_A_EMAIL||!process.env.TEST_SELLER_A_PASSWORD){
 console.log('NOT RUN: Configure Supabase and TEST_SELLER_A_EMAIL/PASSWORD locally.');process.exitCode=2;
}else{
 const db=createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false}});
 let stage="sign-in";
 try{
 const {data,error}=await db.auth.signInWithPassword({email:process.env.TEST_SELLER_A_EMAIL,password:process.env.TEST_SELLER_A_PASSWORD});assert.ok(!error,'Sign-in failed');
 stage='migration and unverified-account check';
 const access=await db.rpc('has_verified_business');assert.ok(!access.error,'Apply migration 202610170003 first');assert.equal(access.data,false,'Use an unverified disposable account for this negative test');
 stage='RLS product and self-verification denial';
 const products=await db.from('products').select('id');assert.ok(!products.error);assert.deepEqual(products.data,[]);
 const result=await db.from('products').insert({id:randomUUID(),seller_id:data.user.id,snapshot:{version:2,fields:{}}});assert.ok(result.error,'Unverified product insert was allowed');
 const escalation=await db.from('seller_verifications').upsert({seller_id:data.user.id,kind:'business',status:'verified',provider_reference:'UNTRUSTED-TEST',verified_at:new Date().toISOString()});assert.ok(escalation.error,'Self-verification was allowed');
 console.log('PASS: live unverified product read/write denial and self-verification denial. No provider or browser flow tested.');
 }catch{console.error('FAIL: live business gate check stopped at '+stage+'. No credentials logged.');process.exitCode=1}
 finally{await db.auth.signOut()}
}
