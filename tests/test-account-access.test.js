import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {once} from 'node:events';
import {testAccountConfig,hasTestAccountAccess} from '../server/test-account-access.js';
import {installSellers} from '../server/sellers.js';
const env={KRITI_TEST_ACCOUNT_ACCESS:'true',TEST_SELLER_A_EMAIL:'a@example.test',TEST_SELLER_B_EMAIL:'b@example.test'};
test('all-account local demo accepts any authenticated user without business or email allowlist checks',()=>{
 const config=testAccountConfig({KRITI_DEMO_ALL_ACCOUNTS:'true'});
 assert.equal(hasTestAccountAccess({id:'ordinary-user'},'127.0.0.1',config),true);
 assert.equal(hasTestAccountAccess(null,'127.0.0.1',config),false);
 assert.equal(hasTestAccountAccess({id:'ordinary-user'},'192.0.2.1',config),false);
 assert.equal(hasTestAccountAccess({id:'ordinary-user'},'127.0.0.1',testAccountConfig({KRITI_DEMO_ALL_ACCOUNTS:'true',NODE_ENV:'production'})),false);
});
test('test access requires explicit local configuration and confirmed authenticated email',()=>{
 const user={email:'A@example.test',email_confirmed_at:'2026-01-01'};
 assert.equal(hasTestAccountAccess(user,'127.0.0.1',testAccountConfig(env)),true);
 for(const extra of [{NODE_ENV:'production'},{HOST:'0.0.0.0'},{KRITI_TEST_ACCOUNT_ACCESS:'false'}])assert.equal(hasTestAccountAccess(user,'127.0.0.1',testAccountConfig({...env,...extra})),false);
 assert.equal(hasTestAccountAccess(user,'192.0.2.1',testAccountConfig(env)),false);
 assert.equal(hasTestAccountAccess({...user,email_confirmed_at:null},'127.0.0.1',testAccountConfig(env)),false);
 assert.equal(hasTestAccountAccess({...user,email:'other@example.test',user_metadata:{email:'a@example.test'}},'127.0.0.1',testAccountConfig(env)),false);
});
test('only allowed confirmed accounts bypass verification for demo generation; storage and publishing remain gated (mock)',async()=>{
 const app=express();let dbReads=0;
 installSellers(app,{settings:{configured:true,url:'https://example.test',key:'sb_publishable_test'},testAccounts:testAccountConfig(env),clientFactory:()=>({auth:{getUser:async token=>({data:{user:token==='invalid'?null:{id:token,email:token+'@example.test',email_confirmed_at:token==='unconfirmed'?null:'2026-01-01'}}})},from(){dbReads++;return {select(){return this},eq:async()=>({data:[]})}}})});
 app.post('/api/marketing',(_q,r)=>r.json({ok:true}));app.post('/api/instagram/publish',(_q,r)=>r.json({ok:true}));
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
 try{
  for(const token of ['a','b']){
   const headers={Authorization:'Bearer '+token};const result=await fetch(base+'/api/seller/demo-access',{headers});const body=await result.json();assert.equal(body.demo_access,true);assert.equal(body.business_verified,false);assert.match(body.notice,/not verified/);
   assert.equal((await fetch(base+'/api/marketing',{method:'POST',headers})).status,200);
  }
  assert.equal(dbReads,0);
  assert.equal((await fetch(base+'/api/marketing',{method:'POST',headers:{Authorization:'Bearer other','X-Test-Email':'a@example.test'}})).status,403);
  assert.equal((await fetch(base+'/api/seller/demo-access')).status,401);
  for(const path of ['/api/products','/api/instagram/publish'])assert.equal((await fetch(base+path,{method:path.includes('publish')?'POST':'GET',headers:{Authorization:'Bearer a'}})).status,403);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
});
