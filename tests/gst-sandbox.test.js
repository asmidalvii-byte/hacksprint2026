import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {once} from 'node:events';
import {createGstSandbox} from '../server/gst-sandbox.js';
import {installSellers} from '../server/sellers.js';
import {businessAccess} from '../server/verification.js';
const settings={enabled:true,apiKey:'fixture-key',apiSecret:'fixture-secret'};
const input={gstin:'27ABCDE1234F1Z5',consent:true,legal_name:'Sample Shop'};
const fixture=()=>({code:200,data:{status_cd:'1',data:{gstin:input.gstin,lgnm:'Sample Shop',sts:'Active'}},transaction_id:'fixture-reference'});
const ok=body=>({ok:true,status:200,json:async()=>body});
function adapter(payload=fixture()){let calls=0;return createGstSandbox({settings,fetchImpl:async()=>ok(++calls===1?{code:200,data:{access_token:'fixture-token'}}:payload)})}
test('GST sandbox documented auth and search use test host only; credentials stay server-side (mock)',async()=>{
 const calls=[];
 const lookup=createGstSandbox({settings,fetchImpl:async(url,init)=>{calls.push({url,init});return ok(calls.length===1?{code:200,data:{access_token:'fixture-token'}}:fixture())}});
 const result=await lookup(input);
 assert.equal(calls[0].url,'https://test-api.sandbox.co.in/authenticate');assert.equal(calls[0].init.headers['x-api-secret'],settings.apiSecret);
 assert.equal(calls[1].url,'https://test-api.sandbox.co.in/gst/compliance/public/gstin/search');assert.equal(calls[1].init.headers.authorization,'fixture-token');assert.equal(calls[1].init.headers['x-api-secret'],undefined);
 assert.equal(calls[1].init.redirect,'error');assert.deepEqual(JSON.parse(calls[1].init.body),{gstin:input.gstin});
 assert.equal(result.data.name_match,true);assert.equal(result.data.access_allowed,false);assert.equal(result.authoritative,false);assert.equal(result.environment,'test');
 assert.equal(businessAccess([result.data]).allowed,false);
 for(const secret of ['fixture-key','fixture-secret','fixture-token',input.gstin])assert.ok(!JSON.stringify(result).includes(secret));
});
test('missing credentials, invalid input and absent consent never call provider',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;throw Error('must not call')};
 await assert.rejects(createGstSandbox({settings:{},fetchImpl})(input),{code:'GST_SANDBOX_SETUP_REQUIRED'});
 for(const body of [{...input,consent:false},{...input,gstin:'invalid'},{...input,status:'verified'}])await assert.rejects(createGstSandbox({settings,fetchImpl})(body));
 assert.equal(calls,0);
});
test('inactive and name mismatch remain test findings; partial/mismatched records and embedded errors fail closed',async()=>{
 let body=fixture();body.data.data.sts='Cancelled';let result=await adapter(body)({...input,legal_name:'Another Shop'});assert.equal(result.data.active,false);assert.equal(result.data.name_match,false);assert.equal(result.data.access_allowed,false);
 for(const mutate of [p=>delete p.data.data.lgnm,p=>p.data.data.gstin='29ABCDE1234F1Z5',p=>p.data.status_cd='0',p=>delete p.transaction_id,p=>p.code=500]){body=fixture();mutate(body);await assert.rejects(adapter(body)(input))}
});
test('provider auth failures, rate limits and transport exceptions are sanitized',async()=>{
 for(const status of [401,403,429,500])await assert.rejects(createGstSandbox({settings,fetchImpl:async()=>({ok:false,status})})(input),e=>!e.message.includes(settings.apiSecret)&&e.code.startsWith('GST_SANDBOX_'));
 await assert.rejects(createGstSandbox({settings,fetchImpl:async()=>{throw Error('fixture-secret')}})(input),e=>!e.message.includes('fixture-secret'));
});
test('unverified signed-in users can call sandbox, unauthenticated users cannot, and no database writes occur (mock)',async()=>{
 const app=express();installSellers(app,{settings:{configured:true,url:'https://example.supabase.co',key:'sb_publishable_test'},clientFactory:()=>({auth:{getUser:async()=>({data:{user:{id:'seller'}}})},from(){throw Error('Sandbox must not touch database')}}),gstSandbox:adapter()});
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');
 try{
  const url=`http://127.0.0.1:${server.address().port}/api/seller/verification/gst/sandbox`;
  assert.equal((await fetch(url,{method:'POST'})).status,401);
  const response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer fixture','Content-Type':'application/json'},body:JSON.stringify(input)});assert.equal(response.status,200);assert.equal((await response.json()).data.access_allowed,false);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
});
