// All Meta, Auth and database responses in this file are test doubles. No public posts.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {createInstagram,encryptToken,decryptToken,validateCaption} from '../server/instagram.js';
import {instagramConfig,createInstagramProvider,InstagramError,permissions} from '../server/instagram-provider.js';
const seller=randomUUID(),other=randomUUID(),product=randomUUID(),config={configured:true,key:'ab'.repeat(32),url:'https://storage.example',appId:'app',secret:'secret',redirect:'https://kriti.example/auth/instagram/callback',version:'v99.0'};
function database(){
 const tables={seller_verifications:[{seller_id:seller,kind:'business',status:'verified',provider_reference:'real-provider',verified_at:'2020-01-01'},{seller_id:seller,kind:'gst',status:'verified',provider_reference:'real-provider',verified_at:'2020-01-01'}],products:[{id:product,seller_id:seller,image_path:seller+'/photo',snapshot:{fields:{confirmed:{checked:true}}}}]};
 const images=new Map();
 return {tables,images,storage:{from:()=>({download:async p=>({data:new Blob([images.get(p)||'bad'])}),upload:async(p,b)=>{images.set(p,b);return {data:{}}},remove:async()=>({}),createSignedUrl:async p=>({data:{signedUrl:config.url+'/storage/v1/'+p}})})},from(table){
  tables[table]||=[];let filters=[],op='select',value,single=false;
  const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},gt(k,v){filters.push(r=>r[k]>v);return q},maybeSingle(){single=true;return q},single(){single=true;return q},insert(v){op='insert';value=v;return q},upsert(v){op='upsert';value=v;return q},delete(){op='delete';return q},update(v){op='update';value=v;return q},then(resolve,reject){return Promise.resolve().then(()=>{
   let rows=tables[table].filter(r=>filters.every(f=>f(r)));
   if(op==='insert'||op==='upsert'){
    const dup=tables[table].find(r=>table==='instagram_jobs'?r.approval_id===value.approval_id:table==='instagram_connections'?r.account_id===value.account_id&&r.seller_id!==value.seller_id:false);
    if(dup)return {error:{code:'23505'}};
    if(op==='upsert')tables[table]=tables[table].filter(r=>r.seller_id!==value.seller_id);
    rows=[{...value}];tables[table].push(...rows);
   }
   if(op==='delete')tables[table]=tables[table].filter(r=>!rows.includes(r));
   if(op==='update')rows.forEach(r=>Object.assign(r,value));
   return {data:single?(rows[0]?{...rows[0]}:null):rows.map(r=>({...r})),error:null};
  }).then(resolve,reject)}};return q;
 }};
}
async function harness(t,overrides={}){
 const db=database();db.images.set(seller+'/photo',await sharp({create:{width:500,height:500,channels:3,background:'white'}}).jpeg().toBuffer());
 let publishes=0;
 const provider={authorize:s=>'https://www.instagram.com/oauth/authorize?state='+s,exchange:async()=>({token:'never-return-this',expiresAt:'2099-01-01'}),identity:async()=>({account_id:'123',username:'shop',permissions}),create:async()=>({id:'456'}),container:async()=>({status_code:'FINISHED'}),publish:async()=>{publishes++;return {id:'789'}},...overrides};
 const app=express(),ig=createInstagram({config,db,provider});ig.installCallback(app);
 app.use((req,res,next)=>{req.seller=req.get('x-seller')||seller;req.sellerDb=db;next()});ig.installRoutes(app);
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>{server.closeAllConnections();server.close(r)}));
 const base='http://127.0.0.1:'+server.address().port;
 const call=(path,body,headers={})=>fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...headers},body:body?JSON.stringify(body):undefined});
 async function connect(){const r=await call('/api/instagram/connect',{}),j=await r.json();const state=new URL(j.authorization_url).searchParams.get('state'),cookie=r.headers.get('set-cookie').split(';')[0];return {state,cookie}}
 async function linked(){const {state,cookie}=await connect();assert.equal((await call('/auth/instagram/callback?state='+state+'&code=valid',null,{cookie})).status,200)}
 return {db,call,connect,linked,publishes:()=>publishes};
}
test('tokens use authenticated encryption bound to seller; caption and config fail closed',()=>{
 const cipher=encryptToken('private-token',config.key,seller);assert.ok(!cipher.includes('private-token'));assert.equal(decryptToken(cipher,config.key,seller),'private-token');assert.throws(()=>decryptToken(cipher,config.key,other));assert.throws(()=>decryptToken(cipher+'x',config.key,seller));assert.throws(()=>validateCaption('x'.repeat(2201)));assert.throws(()=>validateCaption(''));assert.equal(instagramConfig({}).configured,false);
});
test('OAuth state is browser-bound, expiring and one-use; denial and missing code do not connect (mock)',async t=>{
 const h=await harness(t);let {state,cookie}=await h.connect();
 assert.equal((await h.call('/auth/instagram/callback?state='+state+'&code=ok')).status,400);
 assert.equal((await h.call('/auth/instagram/callback?state='+state+'&error=access_denied',null,{cookie})).status,400);assert.equal(h.db.tables.instagram_connections?.length||0,0);
 assert.equal((await h.call('/auth/instagram/callback?state='+state+'&code=ok',null,{cookie})).status,400);
 ({state,cookie}=await h.connect());h.db.tables.instagram_oauth_states[0].expires_at='2000';assert.equal((await h.call('/auth/instagram/callback?state='+state+'&code=ok',null,{cookie})).status,400);
 ({state,cookie}=await h.connect());assert.equal((await h.call('/auth/instagram/callback?state='+state,null,{cookie})).status,400);
 await h.linked();assert.ok(!JSON.stringify(h.db.tables.instagram_connections).includes('never-return-this'));const status=await(await h.call('/api/instagram/status')).json();assert.equal(status.state,'connected');assert.ok(!JSON.stringify(status).includes('token'));assert.equal((await(await h.call('/api/instagram/status',null,{'x-seller':other})).json()).state,'not_connected');
});
test('callback rechecks business approval; provider denial cannot create connection (mock)',async t=>{
 const h=await harness(t);const {state,cookie}=await h.connect();h.db.tables.seller_verifications=[];assert.equal((await h.call('/auth/instagram/callback?state='+state+'&code=x',null,{cookie})).status,403);
});
test('approval ownership, immutable bytes, explicit approval and duplicate publication (mock)',async t=>{
 const h=await harness(t);await h.linked();
 assert.equal((await h.call('/api/instagram/publish',{approved:true})).status,400);
 assert.equal((await h.call('/api/instagram/approvals',{product_id:product,action:'approve_exact_post',caption:'Reviewed caption'},{'x-seller':other})).status,404);
 const r=await h.call('/api/instagram/approvals',{product_id:product,action:'approve_exact_post',caption:'Reviewed caption'});assert.equal(r.status,201);const {approval_id}=await r.json();
 h.db.images.set(seller+'/photo',Buffer.from('changed'));assert.notEqual(h.db.images.get(h.db.tables.instagram_approvals[0].image_path).toString(),'changed');
 assert.equal((await h.call('/api/instagram/publish',{approval_id},{'x-seller':other})).status,404);
 const results=await Promise.all([h.call('/api/instagram/publish',{approval_id}),h.call('/api/instagram/publish',{approval_id})]);const jobs=await Promise.all(results.map(r=>r.json()));assert.ok(jobs.some(j=>j.state==='published'));assert.equal(h.publishes(),1);
 await h.call('/api/instagram/publish',{approval_id});assert.equal(h.publishes(),1);
 assert.equal((await h.call('/api/instagram/jobs/'+jobs[0].job_id,null,{'x-seller':other})).status,404);
});
test('publish timeout is persisted as unknown and never retried (mock)',async t=>{
 let attempts=0;const h=await harness(t,{publish:async()=>{attempts++;throw Error('private provider payload')}});await h.linked();const {approval_id}=await(await h.call('/api/instagram/approvals',{product_id:product,action:'approve_exact_post',caption:'Post'})).json();
 let j=await(await h.call('/api/instagram/publish',{approval_id})).json();assert.equal(j.state,'publishing');assert.equal(j.error_code,'PUBLISH_OUTCOME_UNKNOWN');j=await(await h.call('/api/instagram/publish',{approval_id})).json();assert.equal(attempts,1);assert.ok(!JSON.stringify(j).includes('private'));
});
test('invalid media, expired token, processing and failed container stay unpublished (mock)',async t=>{
 const h=await harness(t,{container:async()=>({status_code:'IN_PROGRESS'})});await h.linked();h.db.images.set(seller+'/photo',Buffer.from('bad'));assert.equal((await h.call('/api/instagram/approvals',{product_id:product,action:'approve_exact_post',caption:'Post'})).status,400);
 h.db.tables.instagram_connections[0].expires_at='2000-01-01';assert.equal((await(await h.call('/api/instagram/status')).json()).state,'reconnect_required');
});
test('provider errors sanitize credentials and permission checks fail closed (mock HTTP)',async()=>{
 const p=createInstagramProvider(config,async()=>({ok:false,json:async()=>({error:{code:190,message:'secret-token'}})}));await assert.rejects(p.identity('secret-token'),e=>e.code==='RECONNECT_REQUIRED'&&!e.message.includes('secret'));
 const missing=createInstagramProvider(config,async url=>({ok:true,json:async()=>String(url).includes('permissions')?{data:[]}:{user_id:'123',username:'shop',account_type:'BUSINESS'}}));await assert.rejects(missing.identity('token'),e=>e.code==='PERMISSION_REQUIRED');
});
test('processing resumes on explicit retry; failed containers never publish (mock)',async t=>{
 let state='IN_PROGRESS';const h=await harness(t,{container:async()=>({status_code:state})});await h.linked();const {approval_id}=await(await h.call('/api/instagram/approvals',{product_id:product,action:'approve_exact_post',caption:'Post'})).json();
 assert.equal((await(await h.call('/api/instagram/publish',{approval_id})).json()).state,'processing');assert.equal(h.publishes(),0);
 state='ERROR';assert.equal((await(await h.call('/api/instagram/publish',{approval_id})).json()).state,'failed');assert.equal(h.publishes(),0);
});
test('container creation failure is durable and is not retried; disconnect clears state and token (mock)',async t=>{
 let attempts=0;const h=await harness(t,{create:async()=>{attempts++;throw new InstagramError('META_RESPONSE_UNCERTAIN',504)}});await h.linked();const {approval_id}=await(await h.call('/api/instagram/approvals',{product_id:product,action:'approve_exact_post',caption:'Post'})).json();
 assert.equal((await(await h.call('/api/instagram/publish',{approval_id})).json()).state,'failed');await h.call('/api/instagram/publish',{approval_id});assert.equal(attempts,1);assert.equal(h.publishes(),0);
 await h.connect();await h.call('/api/instagram/disconnect',{});assert.equal(h.db.tables.instagram_connections.length,0);assert.equal(h.db.tables.instagram_oauth_states.length,0);
});
test('provider uses Instagram Login endpoints and validates long-lived exchange (mock HTTP)',async()=>{
 const calls=[];const p=createInstagramProvider(config,async(url,init)=>{calls.push({url:String(url),init});return {ok:true,json:async()=>calls.length===1?{access_token:'short'}:{access_token:'long',expires_in:3600}}});
 assert.equal(new URL(p.authorize('state')).searchParams.get('scope'),permissions.join(','));assert.equal((await p.exchange('code')).token,'long');assert.equal(calls[0].url,'https://api.instagram.com/oauth/access_token');assert.equal(calls[0].init.body.get('redirect_uri'),config.redirect);assert.equal(new URL(calls[1].url).hostname,'graph.instagram.com');
});
