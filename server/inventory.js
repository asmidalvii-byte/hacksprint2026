import express from 'express';
import {randomUUID} from 'node:crypto';
export const inventoryColumns='id,product_id,name,sku,category,quantity,low_stock_threshold,price,currency,description,version,created_at,updated_at,stock_status';
const uuid=v=>typeof v==='string'&&/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(v);
export function inventoryInput(body){
 if(!body||Array.isArray(body)||Object.keys(body).some(k=>!['product_id','name','sku','category','quantity','low_stock_threshold','price','currency','description','version'].includes(k)))throw Error('Invalid inventory fields.');
 const text=(k,max,required=false)=>{const v=body[k];if(typeof v!=='string'||v.length>max||(required&&!v.trim()))throw Error('Check '+k.replaceAll('_',' ')+'.');return v.trim()};
 const number=k=>{const v=body[k];if(!Number.isSafeInteger(v)||v<0||v>1000000)throw Error('Use a whole non-negative '+k.replaceAll('_',' ')+'.');return v};
 if(body.product_id!==null&&!uuid(body.product_id))throw Error('Choose a saved product or leave it unlinked.');
 if(body.category!=='saree'||!['INR','USD','GBP','EUR'].includes(body.currency))throw Error('Choose a supported category and currency.');
 if(body.price!==null&&(typeof body.price!=='number'||!Number.isFinite(body.price)||body.price<0||body.price>10000000||Math.abs(body.price*100-Math.round(body.price*100))>0.00001))throw Error('Use a valid price with at most two decimal places.');
 return {product_id:body.product_id,name:text('name',150,true),sku:text('sku',80,true),category:body.category,quantity:number('quantity'),low_stock_threshold:number('low_stock_threshold'),price:body.price,currency:body.currency,description:text('description',2000)};
}
export function stockStatus(quantity,threshold){return quantity===0?'out_of_stock':quantity<=threshold?'low_stock':'in_stock'}
export function inventoryQuery(query){
 const page=Number(query.page||1);if(!Number.isSafeInteger(page)||page<1||page>100000)throw Error('Invalid page.');
 const search=String(query.search||'').trim();if(search.length>100)throw Error('Search is too long.');
 const status=String(query.status||''),category=String(query.category||''),sort=String(query.sort||'updated');
 if(!['','in_stock','low_stock','out_of_stock'].includes(status)||!['','saree'].includes(category)||!['updated','name','quantity'].includes(sort))throw Error('Invalid inventory filter.');
 return {page,search,status,category,sort};
}
export function installInventory(app){
 const safe=fn=>async(req,res)=>{try{await fn(req,res)}catch(e){res.status(e.input?400:503).json({error:{code:e.input?'INVALID_INVENTORY':'INVENTORY_UNAVAILABLE',message:e.input?e.message:'Inventory is unavailable. Check database setup and retry; no success was confirmed.'}})}};
 const validate=fn=>{try{return fn()}catch(e){e.input=true;throw e}};
 const data=async q=>{const r=await q;if(r.error)throw Error();return r};
 const own=req=>req.sellerDb.from('inventory_items');
 app.get('/api/inventory',safe(async(req,res)=>{
  const {page,search,status,category,sort}=validate(()=>inventoryQuery(req.query));let q=own(req).select(inventoryColumns,{count:'exact'}).eq('seller_id',req.seller);
  if(search){const literal=search.replace(/[^\p{L}\p{N}\s-]/gu,' ');q=q.or(`name.ilike.%${literal}%,sku.ilike.%${literal}%`)}
  if(status)q=q.eq('stock_status',status);if(category)q=q.eq('category',category);
  q=q.order(sort==='updated'?'updated_at':sort,{ascending:sort!=='updated'}).order('id',{ascending:true}).range((page-1)*20,page*20-1);
  const r=await data(q);const items=await Promise.all(r.data.map(async item=>{let image_url=null;if(item.product_id){const linked=await data(req.sellerDb.from('products').select('image_path').eq('seller_id',req.seller).eq('id',item.product_id).maybeSingle());if(linked.data?.image_path){const signed=await req.sellerDb.storage.from('product-images').createSignedUrl(linked.data.image_path,300);image_url=signed.data?.signedUrl||null}}return {...item,image_url}}));res.json({items,total:r.count,page,page_size:20});
 }));
 app.get('/api/inventory-summary',safe(async(req,res)=>{
  const queries=[req.sellerDb.from('products').select('id',{head:true,count:'exact'}).eq('seller_id',req.seller),own(req).select('id',{head:true,count:'exact'}).eq('seller_id',req.seller),own(req).select('id',{head:true,count:'exact'}).eq('seller_id',req.seller).eq('stock_status','low_stock'),own(req).select('id',{head:true,count:'exact'}).eq('seller_id',req.seller).eq('stock_status','out_of_stock')];
  const results=await Promise.all(queries.map(data));res.json(Object.fromEntries(['products','inventory','low_stock','out_of_stock'].map((k,i)=>[k,results[i].count])));
 }));
 app.get('/api/inventory/:id',safe(async(req,res)=>{
  if(!uuid(req.params.id))return res.sendStatus(400);const r=await data(own(req).select(inventoryColumns).eq('seller_id',req.seller).eq('id',req.params.id).maybeSingle());if(!r.data)return res.sendStatus(404);
  let image_url=null;if(r.data.product_id){const product=await data(req.sellerDb.from('products').select('image_path').eq('seller_id',req.seller).eq('id',r.data.product_id).maybeSingle());if(product.data?.image_path){const signed=await data(req.sellerDb.storage.from('product-images').createSignedUrl(product.data.image_path,300));image_url=signed.data.signedUrl}}
  res.json({...r.data,image_url});
 }));
 app.post('/api/inventory',express.json({limit:'8kb'}),safe(async(req,res)=>{
  const values=validate(()=>inventoryInput(req.body));const r=await own(req).insert({id:randomUUID(),seller_id:req.seller,...values}).select(inventoryColumns).single();if(r.error)return res.status(r.error.code==='23505'?409:400).json({error:{message:'Could not add item. Use a unique SKU and a saved product belonging to your account.'}});res.status(201).json(r.data);
 }));
 app.put('/api/inventory/:id',express.json({limit:'8kb'}),safe(async(req,res)=>{
  const values=validate(()=>inventoryInput(req.body));if(!uuid(req.params.id)||!Number.isSafeInteger(req.body.version)||req.body.version<1)return res.sendStatus(400);
  const r=await own(req).update(values).eq('id',req.params.id).eq('seller_id',req.seller).eq('version',req.body.version).select(inventoryColumns).maybeSingle();if(r.error)return res.status(409).json({error:{message:'Could not save. Check SKU and linked product, then refresh.'}});if(!r.data)return res.status(409).json({error:{message:'This item changed or is unavailable. Reload it before saving.'}});res.json(r.data);
 }));
 app.delete('/api/inventory/:id',safe(async(req,res)=>{
  const version=Number(req.query.version);if(!uuid(req.params.id)||!Number.isSafeInteger(version)||version<1)return res.sendStatus(400);const r=await data(own(req).delete().eq('seller_id',req.seller).eq('id',req.params.id).eq('version',version).select('id'));if(!r.data.length)return res.status(409).json({error:{message:'This item changed or is unavailable. Refresh and retry.'}});res.status(204).end();
 }));
}
