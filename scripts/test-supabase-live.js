// Requires two existing, confirmed disposable test accounts. Never logs credentials.
import 'dotenv/config';import {createClient} from '@supabase/supabase-js';import {randomUUID} from 'node:crypto';import assert from 'node:assert/strict';import {sellerConfig} from '../server/sellers.js';
const config=sellerConfig();const required=['TEST_SELLER_A_EMAIL','TEST_SELLER_A_PASSWORD','TEST_SELLER_B_EMAIL','TEST_SELLER_B_PASSWORD'];
if(!config.configured||required.some(k=>!process.env[k])){console.log('NOT RUN: Configure Supabase and two confirmed test accounts locally. See docs/KRITI-SETUP.md.');process.exitCode=2}else{
 const clients=[0,1].map(()=>createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false}}));const id=randomUUID();let owner,created=false,imagePath;
 try{
 const users=[];for(const [i,name]of ['A','B'].entries()){const {data,error}=await clients[i].auth.signInWithPassword({email:process.env['TEST_SELLER_'+name+'_EMAIL'],password:process.env['TEST_SELLER_'+name+'_PASSWORD']});assert.equal(Boolean(error),false,'Test-account sign-in failed');users.push(data.user)}
 assert.notEqual(users[0].id,users[1].id,'Two different accounts required');owner=users[0].id;
 const snapshot={version:2,fields:{title:{value:'TEST ONLY — isolation check'},price:{value:'1000'},priceApproved:{checked:true},confirmed:{checked:true}}};
 let result=await clients[0].from('products').insert({id,seller_id:owner,title:'TEST ONLY — isolation check',snapshot}).select();assert.equal(Boolean(result.error),false,'Owner insert failed');created=true;
 result=await clients[0].from('products').select('snapshot').eq('id',id).single();assert.equal(result.data?.snapshot.fields.priceApproved.checked,true,'Approval restore failed');
 for(const operation of ['read','update','delete']){let query=clients[1].from('products');query=operation==='read'?query.select('id'):operation==='update'?query.update({title:'Unauthorized modification'}).select('id'):query.delete().select('id');result=await query.eq('id',id);assert.ok(result.error||result.data?.length===0,'Cross-seller '+operation+' was permitted')}
 result=await clients[1].from('seller_verifications').select('kind').eq('seller_id',owner);assert.ok(result.error||result.data?.length===0,'Cross-seller verification read allowed');
 result=await clients[0].from('seller_verifications').upsert({seller_id:owner,kind:'identity',status:'verified',provider_reference:'TEST-UNTRUSTED',verified_at:new Date().toISOString()});assert.ok(result.error,'Seller escalated verification status');
 imagePath=owner+'/'+id;const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aLTcAAAAASUVORK5CYII=','base64');result=await clients[0].storage.from('product-images').upload(imagePath,png,{contentType:'image/png'});assert.equal(Boolean(result.error),false,'Owner image upload failed');
 result=await clients[1].storage.from('product-images').download(imagePath);assert.ok(result.error,'Cross-seller private image read allowed');
 console.log('PASS: live Supabase owner save/restore, cross-seller product isolation, verification write denial and private image isolation. No browser UI or email delivery tested.');
 }catch{console.error('FAIL: live Supabase isolation check did not complete. Check migrations, test accounts and policies; no credentials logged.');process.exitCode=1}
 finally{if(imagePath){const r=await clients[0].storage.from('product-images').remove([imagePath]);if(r.error){console.error('Test image cleanup requires attention.');process.exitCode=1}}if(created){const r=await clients[0].from('products').delete().eq('id',id).eq('seller_id',owner);if(r.error){console.error('Test record cleanup requires attention.');process.exitCode=1}}}
}
