// Mock database/Auth tests; these do not prove live Supabase RLS.
import {test} from 'node:test';import assert from 'node:assert/strict';import express from 'express';import {randomUUID} from 'node:crypto';
import {installInventory,inventoryInput,inventoryQuery,stockStatus} from '../server/inventory.js';import {installSellers} from '../server/sellers.js';import {verifiedRecords} from './verified-app-fixture.js';
const a=randomUUID(),b=randomUUID(),valid={product_id:null,name:'White saree',sku:'S-1',category:'saree',quantity:10,low_stock_threshold:5,price:null,currency:'INR',description:''};
test('inventory validates quantities, money, identifiers and unknown ownership fields',()=>{
 assert.equal(inventoryInput(valid).price,null);for(const delta of [{quantity:-1},{quantity:1.2},{quantity:Infinity},{low_stock_threshold:-1},{price:1.234},{price:'100'},{category:'jewellery'},{seller_id:b},{product_id:'bad'},{name:''}])assert.throws(()=>inventoryInput({...valid,...delta}));
 assert.equal(stockStatus(0,5),'out_of_stock');assert.equal(stockStatus(5,5),'low_stock');assert.equal(stockStatus(6,5),'in_stock');assert.equal(inventoryQuery({page:'2',status:'low_stock',sort:'quantity'}).page,2);for(const q of [{page:'-1'},{sort:'seller_id'},{status:'verified'}])assert.throws(()=>inventoryQuery(q));
});
test('inventory CRUD, filtering, revision conflict and cross-seller denial (mock HTTP)',async t=>{
 let rows=[];
 function client(token){return {auth:{getUser:async()=>({data:{user:[a,b,'unverified'].includes(token)?{id:token}:null}})},from(table){let filters=[],op='select',values,one=false,count=false,from=0,to=999,sort='updated_at';const q={select(_c,options){count=options?.count==='exact';return q},eq(k,v){filters.push(r=>r[k]===v);return q},order(k){if(k!=='id')sort=k;return q},range(f,t){from=f;to=t;return q},or(expr){const s=expr.split('%')[1].toLowerCase();filters.push(r=>r.name.toLowerCase().includes(s)||r.sku.toLowerCase().includes(s));return q},maybeSingle(){one=true;return q},single(){one=true;return q},insert(v){op='insert';values=v;return q},update(v){op='update';values=v;return q},delete(){op='delete';return q},then(resolve,reject){return Promise.resolve().then(()=>{
  if(table==='seller_verifications')return {data:token==='unverified'?[]:verifiedRecords};
  if(table==='products')return {data:[],count:0};
  let selected=rows.filter(r=>r.seller_id===token&&filters.every(f=>f(r)));
  if(op==='insert'){if(values.seller_id!==token)return {error:{}};if(rows.some(r=>r.seller_id===token&&r.sku.toLowerCase()===values.sku.toLowerCase()))return {error:{code:'23505'}};const row={...values,version:1,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),stock_status:stockStatus(values.quantity,values.low_stock_threshold)};rows.push(row);selected=[row]}
  if(op==='update')selected.forEach(r=>Object.assign(r,values,{version:r.version+1,stock_status:stockStatus(values.quantity,values.low_stock_threshold)}));
  if(op==='delete')rows=rows.filter(r=>!selected.includes(r));
  selected.sort((x,y)=>String(x[sort]).localeCompare(String(y[sort])));const total=selected.length;selected=selected.slice(from,to+1);return {data:one?selected[0]||null:selected,count:count?total:null};
 }).then(resolve,reject)}};return q}}}
 const app=express();installSellers(app,{settings:{configured:true,url:'https://example.test',key:'sb_publishable_test'},testAccounts:{enabled:false,emails:[]},clientFactory:(_u,_k,opts)=>client(opts.global.headers.Authorization.slice(7))});installInventory(app);const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>{server.closeAllConnections();server.close(r)}));const base='http://127.0.0.1:'+server.address().port;
 const call=(path,method='GET',body,token=a)=>fetch(base+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 assert.equal((await call('/api/inventory','GET',null,'invalid')).status,401);assert.equal((await call('/api/inventory','GET',null,'unverified')).status,403);
 const added=await call('/api/inventory','POST',valid);assert.equal(added.status,201);const row=await added.json();assert.equal((await call('/api/inventory','POST',valid)).status,409);
 assert.equal((await call('/api/inventory/'+row.id,'GET',null,b)).status,404);assert.equal((await call('/api/inventory/'+row.id,'PUT',{...valid,version:1},b)).status,409);assert.equal((await call('/api/inventory/'+row.id+'?version=1','DELETE',null,b)).status,409);
 assert.equal((await(await call('/api/inventory?search=white')).json()).total,1);assert.equal((await(await call('/api/inventory?search=missing')).json()).total,0);
 const changed=await(await call('/api/inventory/'+row.id,'PUT',{...valid,version:1,quantity:3})).json();assert.equal(changed.version,2);assert.equal(changed.stock_status,'low_stock');assert.equal((await call('/api/inventory/'+row.id,'PUT',{...valid,version:1})).status,409);
 assert.equal((await(await call('/api/inventory?status=low_stock')).json()).total,1);assert.equal((await(await call('/api/inventory-summary')).json()).low_stock,1);
 assert.equal((await call('/api/inventory/'+row.id+'?version=1','DELETE')).status,409);assert.equal((await call('/api/inventory/'+row.id+'?version=2','DELETE')).status,204);assert.equal((await(await call('/api/inventory')).json()).total,0);
});
