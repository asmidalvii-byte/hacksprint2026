import {createClient} from '@supabase/supabase-js';
import express from 'express';
import rateLimit from 'express-rate-limit';
import {createGstSandbox} from './gst-sandbox.js';
import {safeBusinessDetails, udyamFormatValid, gstFormatValid, providerResult, businessAccess} from './verification.js';
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
export function installSellers(app,{settings=sellerConfig(),clientFactory=createClient,gstSandbox=createGstSandbox()}={}){
 app.get('/api/account-config',(req,res)=>res.json({configured:settings.configured,setupRequired:settings.requested&&!settings.configured,url:settings.configured?settings.url:null,key:settings.configured?settings.key:null}));
 app.get('/api/demo/verification',(req,res)=>res.json({
  demo:true, authoritative:false, notice:'Demonstration data only. No Udyam or GSTIN check was performed.',
  data:{business_status:'verified',udyam_status:'verified',gst_status:'not_applicable',identity_status:'not_applicable',authority_status:'not_applicable',access_allowed:false,next_action:'use_live_verification',business:{business_name:'Sample Handloom Store',state:'Maharashtra'},records:[
   {kind:'business',status:'verified',method:'sample',provider_reference:null,verified_at:null},
   {kind:'udyam',status:'verified',method:'sample',provider_reference:null,verified_at:null}
  ]}
 }));
 const client=token=>clientFactory(settings.url,settings.key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}});
 app.use('/api',async(req,res,next)=>{
  if(['/status','/integrations','/account-config'].includes(req.path))return next();
  if(!settings.configured)return res.status(503).json({code:'ACCOUNT_SETUP_REQUIRED',business_status:null,next_action:'configure_accounts',message:'Seller account setup required.'});
  const token=req.get('authorization')?.match(/^Bearer (.+)$/)?.[1];if(!token)return res.status(401).json({error:{message:'Sign in to continue.'}});
  try{const db=client(token),{data,error}=await db.auth.getUser(token);if(error||!data.user)return res.status(401).json({error:{message:'Session expired. Sign in again.'}});req.seller=data.user.id;req.sellerDb=db;
   const verificationRoutes=new Set(['/verification','/seller/verification','/seller/verification/business','/seller/verification/udyam','/seller/verification/gst','/seller/verification/gst/sandbox','/seller/verification/review','/seller/verification/retry']);
   if(verificationRoutes.has(req.path))return next();
   const {data:records,error:verificationError}=await db.from('seller_verifications').select('kind,status,provider_reference,verified_at,expires_at').eq('seller_id',req.seller);
   if(verificationError)return res.status(503).json({code:'BUSINESS_VERIFICATION_UNAVAILABLE',business_status:null,next_action:'retry_status',message:'Business verification status cannot currently be confirmed.'});
   const access=businessAccess(records);
   if(!access.allowed)return res.status(403).json(access);
   next()}catch{res.status(503).json({error:{message:'Account verification unavailable. Try again.'}})}
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
 const verificationResponse=records=>({success:true,data:{business_status:records.find(x=>x.kind==='business')?.status||'not_started',udyam_status:records.find(x=>x.kind==='udyam')?.status||'not_started',gst_status:records.find(x=>x.kind==='gst')?.status||'not_started',identity_status:records.find(x=>x.kind==='identity')?.status||'setup_required',authority_status:records.find(x=>x.kind==='authority')?.status||'not_started',next_action:records.some(x=>x.status==='verified')?'review_remaining':'start_business_verification',business_name:null,checked_at:records.find(x=>x.verified_at)?.verified_at||null,records},error:null});
 app.get('/api/seller/verification',safe(async(req,res)=>{const [{data:records,error},{data:business,error:businessError}]=await Promise.all([req.sellerDb.from('seller_verifications').select('kind,status,provider_reference,masked_identifier,verified_at,expires_at,updated_at').eq('seller_id',req.seller),req.sellerDb.from('business_details').select('legal_name,business_name,business_type,state,address,gstin,udyam_number,consent,updated_at').eq('seller_id',req.seller).maybeSingle()]);if(error||businessError)throw error||businessError;const access=businessAccess(records);const output=verificationResponse((records||[]).map(({provider_reference,...record})=>record));output.data.access_allowed=access.allowed;output.data.next_action=access.next_action;output.data.business=business||null;res.json(output)}));
 app.post('/api/seller/verification/business',express.json({limit:'16kb'}),safe(async(req,res)=>{let details;try{details=safeBusinessDetails(req.body)}catch(error){return res.status(400).json({success:false,data:null,error:{code:'INVALID_BUSINESS_DETAILS',message:error.message}})}const {data,error}=await req.sellerDb.from('business_details').upsert({seller_id:req.seller,...details,updated_at:new Date().toISOString()},{onConflict:'seller_id'}).select('legal_name,business_name,business_type,state,address,gstin,udyam_number,consent,updated_at').single();if(error)throw error;res.status(201).json({success:true,data:{business: data,verification_status:'not_started',next_action:'choose_verification_route'},error:null})}));
 const providerEndpoint=(kind,format)=>safe(async(req,res)=>{const value=String(req.body?.[kind==='udyam'?'udyam_number':'gstin']||'').trim().toUpperCase();if(!format(value))return res.status(400).json({success:false,data:null,error:{code:'INVALID_'+kind.toUpperCase()+'_FORMAT',message:'Check the '+(kind==='udyam'?'Udyam number':'GSTIN')+' format.'}});const provider=process.env[kind==='udyam'?'UDYAM_PROVIDER_URL':'GST_PROVIDER_URL'];if(!provider)return res.status(503).json({success:false,data:{status:'setup_required',next_action:'provider_setup'},error:{code:'VERIFICATION_SETUP_REQUIRED',message:'No authorized '+kind+' verification provider is configured.'}});return res.status(503).json({success:false,data:{status:'setup_required',next_action:'provider_adapter_required'},error:{code:'VERIFICATION_ADAPTER_REQUIRED',message:'The authorized provider adapter is not enabled.'}})});
 app.post('/api/seller/verification/udyam',express.json({limit:'8kb'}),providerEndpoint('udyam',udyamFormatValid));
 app.post('/api/seller/verification/gst',express.json({limit:'8kb'}),providerEndpoint('gst',gstFormatValid));
 app.post('/api/seller/verification/gst/sandbox',rateLimit({windowMs:60000,limit:3,standardHeaders:'draft-8',legacyHeaders:false,message:{success:false,error:{code:'GST_SANDBOX_RATE_LIMITED',message:'Wait one minute before another sandbox lookup.'}}}),express.json({limit:'8kb'}),async(req,res)=>{
  try{res.json(await gstSandbox(req.body))}catch(error){
   const known=/^(GST_SANDBOX_[A-Z_]+|INVALID_GST_FORMAT|INVALID_GST_SANDBOX_INPUT)$/.test(error.code||'');
   res.status(known?error.status:503).json({success:false,demo:true,authoritative:false,data:{access_allowed:false},error:{code:known?error.code:'GST_SANDBOX_UNAVAILABLE',message:known?error.message:'The GST sandbox is unavailable.'}});
  }
 });
 app.post('/api/seller/verification/review',(_req,res)=>res.status(503).json({success:false,data:{status:'setup_required',next_action:'manual_review_setup'},error:{code:'MANUAL_REVIEW_SETUP_REQUIRED',message:'Manual review is not configured; no review request was recorded.'}}));
 app.post('/api/seller/verification/retry',(_req,res)=>res.status(503).json({success:false,data:{status:'setup_required',next_action:'provider_setup'},error:{code:'VERIFICATION_SETUP_REQUIRED',message:'No supported verification provider is configured.'}}));
 // No documents or raw identity numbers are collected before an authorized provider exists.
 app.post('/api/verification',(_req,res)=>res.status(503).json({error:{code:'VERIFICATION_SETUP_REQUIRED',message:'Verification setup required. No identity, business or GST check has been performed.'}}));
}
