import {createClient} from '@supabase/supabase-js';
import express from 'express';
export function sellerConfig(env=process.env){
 const url=env.SUPABASE_URL||'',key=env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY||'';
 let valid=false;try{valid=new URL(url).protocol==='https:'}catch{}
 // This boundary deliberately accepts public keys only, never service-role keys.
 let publicKey=key.startsWith('sb_publishable_');try{publicKey ||= JSON.parse(Buffer.from(key.split('.')[1],'base64url')).role==='anon'}catch{}
 return {url,key,configured:valid&&publicKey,requested:Boolean(url||key)};
}
export function validSnapshot(value){
 if(!value||value.version!==2||!value.fields||typeof value.fields!=='object'||Array.isArray(value.fields))return false;
 if(Object.keys(value.fields).some(k=>/password|token|email|gst|legal|consent/i.test(k)))return false;
 const price=value.fields.price,approved=value.fields.priceApproved?.checked;
 if(approved&&(!price||!Number.isFinite(Number(price.value))||Number(price.value)<=0||Number(price.value)>10000000))return false;
 return true;
}
export function installSellers(app,{settings=sellerConfig(),clientFactory=createClient}={}){
 app.get('/api/account-config',(req,res)=>res.json({configured:settings.configured,setupRequired:settings.requested&&!settings.configured,url:settings.configured?settings.url:null,key:settings.configured?settings.key:null}));
 const client=token=>clientFactory(settings.url,settings.key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}});
 app.use('/api',async(req,res,next)=>{
  if(['/status','/integrations','/account-config'].includes(req.path))return next();
  if(!settings.configured){if(settings.requested||req.path.startsWith('/products')||req.path.startsWith('/verification'))return res.status(503).json({error:{message:'Seller account setup required.'}});return next()}
  const token=req.get('authorization')?.match(/^Bearer (.+)$/)?.[1];if(!token)return res.status(401).json({error:{message:'Sign in to continue.'}});
  try{const db=client(token),{data,error}=await db.auth.getUser(token);if(error||!data.user)return res.status(401).json({error:{message:'Session expired. Sign in again.'}});req.seller=data.user.id;req.sellerDb=db;next()}catch{res.status(503).json({error:{message:'Account verification unavailable. Try again.'}})}
 });
 const safe=fn=>async(req,res)=>{try{await fn(req,res)}catch{res.status(503).json({error:{message:'Saving or loading failed. Your edits remain in this tab.'}})}};
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 app.get('/api/products',safe(async(req,res)=>{const {data,error}=await req.sellerDb.from('products').select('id,title,updated_at').eq('seller_id',req.seller).order('updated_at',{ascending:false}).limit(100);if(error)throw error;res.json(data)}));
 app.get('/api/products/:id',safe(async(req,res)=>{if(!uuid.test(req.params.id))return res.sendStatus(400);const {data,error}=await req.sellerDb.from('products').select('id,snapshot,image_path').eq('seller_id',req.seller).eq('id',req.params.id).maybeSingle();if(error)throw error;if(!data)return res.sendStatus(404);res.json(data)}));
 app.put('/api/products/:id',express.json({limit:'1mb'}),safe(async(req,res)=>{
  if(!uuid.test(req.params.id)||!validSnapshot(req.body?.snapshot)||Object.keys(req.body).some(k=>!['snapshot','image_path'].includes(k)))return res.status(400).json({error:{message:'Invalid saved product.'}});
  const image=req.body.image_path||null;if(image&&!image.startsWith(req.seller+'/'))return res.sendStatus(400);
  const {data,error}=await req.sellerDb.from('products').upsert({id:req.params.id,seller_id:req.seller,title:String(req.body.snapshot.fields.title?.value||'Untitled product').slice(0,150),snapshot:req.body.snapshot,image_path:image,updated_at:new Date().toISOString()},{onConflict:'id'}).select('id').single();if(error)throw error;res.json(data);
 }));
 app.delete('/api/products/:id',safe(async(req,res)=>{if(!uuid.test(req.params.id))return res.sendStatus(400);const {error}=await req.sellerDb.from('products').delete().eq('seller_id',req.seller).eq('id',req.params.id);if(error)throw error;res.sendStatus(204)}));
 app.get('/api/verification',safe(async(req,res)=>{const {data,error}=await req.sellerDb.from('seller_verifications').select('kind,status,masked_identifier,verified_at,expires_at').eq('seller_id',req.seller);if(error)throw error;res.json({setup_required:true,records:data,message:'Verification setup required. No authorized provider is connected.'})}));
 // No documents or raw identity numbers are collected before an authorized provider exists.
 app.post('/api/verification',(_req,res)=>res.status(503).json({error:{code:'VERIFICATION_SETUP_REQUIRED',message:'Verification setup required. No identity, business or GST check has been performed.'}}));
}
