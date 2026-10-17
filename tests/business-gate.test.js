import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {once} from 'node:events';
import {installSellers} from '../server/sellers.js';
import {businessAccess,safeBusinessDetails} from '../server/verification.js';
import {verifiedRecords} from './verified-app-fixture.js';
test('authoritative business AND current Udyam or GST evidence required',()=>{
 assert.equal(businessAccess(verifiedRecords).allowed,true);
 assert.equal(businessAccess(verifiedRecords.map(r=>({...r,kind:r.kind==='udyam'?'gst':r.kind}))).allowed,true);
 for(const status of ['not_started','in_progress','pending_review','action_required','rejected','failed','setup_required','not_applicable','expired','nonsense'])assert.equal(businessAccess(verifiedRecords.map(r=>({...r,status}))).allowed,false,status);
 for(const records of [null,[],verifiedRecords.slice(0,1),verifiedRecords.slice(1),verifiedRecords.map(r=>({...r,expires_at:'2020-01-02'})),verifiedRecords.map(r=>({...r,provider_reference:''})),verifiedRecords.map(r=>({...r,verified_at:'invalid'}))])assert.equal(businessAccess(records).allowed,false);
 assert.equal(safeBusinessDetails({consent:true}).consent,true);
 assert.throws(()=>safeBusinessDetails({consent:true,status:'verified'}));
});
test('HTTP gate blocks direct protected calls, preserves verification and sanitizes DB failure (mock)',async()=>{
 let records=[],error=null;
 const app=express();installSellers(app,{settings:{configured:true,url:'https://example.supabase.co',key:'sb_publishable_fixture'},clientFactory:()=>({auth:{getUser:async()=>({data:{user:{id:'owner'}}})},from:()=>({select(){return this},eq(k,v){assert.equal(k,'seller_id');assert.equal(v,'owner');return Promise.resolve({data:records,error})}})})});
 for(const path of ['/api/analyze-product','/api/pricing','/api/marketing','/api/voice-ad','/api/instagram/publish'])app.post(path,(_req,res)=>res.json({ok:true}));
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');
 const base='http://127.0.0.1:'+server.address().port,headers={Authorization:'Bearer test','Content-Type':'application/json'};
 try {
 for(const status of ['not_started','in_progress','pending_review','rejected','failed','setup_required','not_applicable']){
 records=verifiedRecords.map(r=>({...r,status}));
 for(const path of ['/api/analyze-product','/api/pricing','/api/marketing','/api/voice-ad','/api/instagram/publish','/api/products']){
 const response=await fetch(base+path,{method:path==='/api/products'?'GET':'POST',headers});assert.equal(response.status,403);assert.equal((await response.json()).business_status,status);
 }}
 records=verifiedRecords;assert.equal((await fetch(base+'/api/marketing',{method:'POST',headers})).status,200);
 records=[];assert.equal((await fetch(base+'/api/marketing',{method:'POST',headers,body:JSON.stringify({status:'verified',seller_id:'other'})})).status,403);
 const submission=await fetch(base+'/api/seller/verification/udyam',{method:'POST',headers,body:JSON.stringify({udyam_number:'UDYAM-MH-12-1234567'})});assert.equal(submission.status,503);assert.equal((await submission.json()).data.status,'setup_required');
 error={message:'private database details'};const unavailable=await fetch(base+'/api/marketing',{method:'POST',headers});assert.equal(unavailable.status,503);assert.ok(!(await unavailable.text()).includes('private'));
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
});
