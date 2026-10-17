import express from 'express';
import rateLimit from 'express-rate-limit';
import {createClient} from '@supabase/supabase-js';
import {randomBytes,randomUUID,createHash,createCipheriv,createDecipheriv} from 'node:crypto';
import sharp from 'sharp';
import {businessAccess} from './verification.js';
import {instagramConfig,createInstagramProvider,InstagramError} from './instagram-provider.js';
const hash=s=>createHash('sha256').update(s).digest('hex');
const uuid=s=>typeof s==='string'&&/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(s);
export function encryptToken(token,key,seller){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',Buffer.from(key,'hex'),iv);cipher.setAAD(Buffer.from(seller));const bytes=Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);return [iv,cipher.getAuthTag(),bytes].map(x=>x.toString('base64url')).join('.')}
export function decryptToken(value,key,seller){const [iv,tag,bytes]=value.split('.').map(x=>Buffer.from(x,'base64url'));const cipher=createDecipheriv('aes-256-gcm',Buffer.from(key,'hex'),iv);cipher.setAAD(Buffer.from(seller));cipher.setAuthTag(tag);return Buffer.concat([cipher.update(bytes),cipher.final()]).toString('utf8')}
export function validateCaption(caption){if(typeof caption!=='string'||!caption.trim()||Array.from(caption).length>2200||(caption.match(/#[^\s#]+/gu)||[]).length>30)throw new InstagramError('INVALID_CAPTION',400);return caption}
export function createInstagram({config=instagramConfig(),provider=createInstagramProvider(config),db}={}){
 if(!db&&config.configured)db=createClient(config.url,config.serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const checked=async q=>{const {data,error}=await q;if(error)throw new InstagramError('INSTAGRAM_STORAGE_UNAVAILABLE',503);return data};
 const one=(table,seller)=>db.from(table).select('*').eq('seller_id',seller);
 const fail=(res,error)=>res.status(error instanceof InstagramError?error.status:503).json({state:error.code==='NOT_CONNECTED'?'not_connected':error.code==='RECONNECT_REQUIRED'?'reconnect_required':error.code==='PERMISSION_REQUIRED'?'permission_required':error.code==='INSTAGRAM_SETUP_REQUIRED'?'setup_required':'failed',error:{code:error instanceof InstagramError?error.code:'INSTAGRAM_UNAVAILABLE',message:error instanceof InstagramError?error.code.replaceAll('_',' ').toLowerCase():'Instagram is unavailable. No success has been confirmed.'}});
 const safe=fn=>async(req,res)=>{try{if(!config.configured)throw new InstagramError('INSTAGRAM_SETUP_REQUIRED',503);await fn(req,res)}catch(e){fail(res,e)}};
 async function verified(seller){const rows=await checked(db.from('seller_verifications').select('kind,status,provider_reference,verified_at,expires_at').eq('seller_id',seller));if(!businessAccess(rows).allowed)throw new InstagramError('BUSINESS_VERIFICATION_REQUIRED',403)}
 async function connection(seller){const c=await checked(one('instagram_connections',seller).maybeSingle());if(!c)throw new InstagramError('NOT_CONNECTED',409);if(Date.parse(c.expires_at)<=Date.now()+60000)throw new InstagramError('RECONNECT_REQUIRED',409);const token=decryptToken(c.token_cipher,config.key,seller);const identity=await provider.identity(token);if(identity.account_id!==c.account_id)throw new InstagramError('RECONNECT_REQUIRED',409);return {...c,token}}
 const cleanJob=j=>({job_id:j.id,state:j.state,media_id:j.media_id||null,permalink:j.permalink||null,error_code:j.error_code||null,updated_at:j.updated_at});
 const update=async(job,changes)=>checked(db.from('instagram_jobs').update({...changes,updated_at:new Date().toISOString()}).eq('id',job.id).eq('seller_id',job.seller_id).select('*').single());
 function installCallback(app){
  // Meta redirects have no Supabase bearer header; a one-use state and HttpOnly browser cookie bind the seller.
  app.get('/auth/instagram/callback',safe(async(req,res)=>{
   const state=req.query.state;if(typeof state!=='string'||!/^[a-f\d]{64}$/.test(state))throw new InstagramError('INVALID_OAUTH_STATE',400);
   const cookie=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('kriti_ig_oauth='))?.slice(15);
   if(!cookie||!/^[a-f\d]{64}$/.test(cookie))throw new InstagramError('INVALID_OAUTH_STATE',400);
   const rows=await checked(db.from('instagram_oauth_states').delete().eq('state_hash',hash(state)).eq('browser_hash',hash(cookie)).gt('expires_at',new Date().toISOString()).select('*'));
   res.clearCookie('kriti_ig_oauth',{path:'/auth/instagram',httpOnly:true,secure:true,sameSite:'lax'});
   if(rows.length!==1)throw new InstagramError('INVALID_OAUTH_STATE',400);
   const seller=rows[0].seller_id;await verified(seller);
   if(req.query.error)throw new InstagramError('AUTHORIZATION_DENIED',400);
   if(typeof req.query.code!=='string'||!req.query.code||req.query.code.length>4096)throw new InstagramError('MISSING_AUTHORIZATION_CODE',400);
   const grant=await provider.exchange(req.query.code),identity=await provider.identity(grant.token);
   // Global account uniqueness prevents linking one Instagram account to two sellers.
   const saved=await db.from('instagram_connections').upsert({seller_id:seller,...identity,token_cipher:encryptToken(grant.token,config.key,seller),expires_at:grant.expiresAt,updated_at:new Date().toISOString()},{onConflict:'seller_id'});
   if(saved.error)throw new InstagramError(saved.error.code==='23505'?'ACCOUNT_ALREADY_LINKED':'INSTAGRAM_STORAGE_UNAVAILABLE',saved.error.code==='23505'?409:503);
   res.json({state:'connected',account:{id:identity.account_id,username:identity.username},message:'Instagram connected. Return to Kriti and refresh connection status.'});
  }));
 }
 function installRoutes(app){
  const router=express.Router();router.use(rateLimit({windowMs:60000,limit:20,standardHeaders:'draft-8',legacyHeaders:false}),express.json({limit:'8kb'}));
  router.get('/status',safe(async(req,res)=>{const c=await checked(one('instagram_connections',req.seller).maybeSingle());if(!c)return res.json({state:'not_connected'});const current=await connection(req.seller);res.json({state:'connected',account:{id:current.account_id,username:current.username},expires_at:current.expires_at})}));
  router.post('/connect',safe(async(req,res)=>{
   const state=randomBytes(32).toString('hex'),browser=randomBytes(32).toString('hex');
   await checked(db.from('instagram_oauth_states').delete().eq('seller_id',req.seller));
   await checked(db.from('instagram_oauth_states').insert({state_hash:hash(state),browser_hash:hash(browser),seller_id:req.seller,expires_at:new Date(Date.now()+600000).toISOString()}));
   res.cookie('kriti_ig_oauth',browser,{httpOnly:true,secure:true,sameSite:'lax',path:'/auth/instagram',maxAge:600000});
   res.json({state:'connecting',authorization_url:provider.authorize(state)});
  }));
  router.post('/disconnect',safe(async(req,res)=>{
   await checked(db.from('instagram_oauth_states').delete().eq('seller_id',req.seller));
   await checked(db.from('instagram_connections').delete().eq('seller_id',req.seller));
   res.json({state:'not_connected',message:'Local connection removed. Remove Kriti in Instagram app settings to revoke provider access.'});
  }));
  router.post('/approvals',safe(async(req,res)=>{
   if(!uuid(req.body?.product_id)||req.body?.action!=='approve_exact_post')throw new InstagramError('APPROVAL_REQUIRED',400);
   const caption=validateCaption(req.body.caption);
   // Use the caller's RLS-scoped client for the existing product and original private image.
   const product=await checked(req.sellerDb.from('products').select('*').eq('seller_id',req.seller).eq('id',req.body.product_id).maybeSingle());
   if(!product)throw new InstagramError('PRODUCT_NOT_FOUND',404);
   if(!product.snapshot?.fields?.confirmed?.checked||!product.image_path?.startsWith(req.seller+'/'))throw new InstagramError('REVIEWED_PRODUCT_REQUIRED',409);
   const file=await checked(req.sellerDb.storage.from('product-images').download(product.image_path));
   const bytes=Buffer.from(await file.arrayBuffer());if(bytes.length>8388608)throw new InstagramError('INVALID_MEDIA',400);
   let meta;try{meta=await sharp(bytes,{limitInputPixels:40000000}).metadata();await sharp(bytes,{limitInputPixels:40000000}).stats()}catch{throw new InstagramError('INVALID_MEDIA',400)}
   if(meta.format!=='jpeg'||meta.width<320||meta.width>1440||meta.width/meta.height<0.8||meta.width/meta.height>1.91)throw new InstagramError('INVALID_MEDIA',400);
   const id=randomUUID(),path=req.seller+'/'+id+'.jpg';
   await checked(db.storage.from('instagram-approved').upload(path,bytes,{contentType:'image/jpeg',upsert:false}));
   try{await checked(db.from('instagram_approvals').insert({id,seller_id:req.seller,product_id:product.id,caption,image_path:path,image_hash:hash(bytes)}))}catch(e){await db.storage.from('instagram-approved').remove([path]);throw e}
   res.status(201).json({approval_id:id,caption,image_sha256:hash(bytes),state:'approved',message:'This approval covers exactly the stored photo and caption. Edits require a new approval.'});
  }));
  router.post('/publish',safe(async(req,res)=>{
   // Legacy requests remain setup-required until configured; never trust approved:true.
   if(!uuid(req.body?.approval_id))throw new InstagramError('APPROVAL_ID_REQUIRED',400);
   const approval=await checked(one('instagram_approvals',req.seller).eq('id',req.body.approval_id).maybeSingle());if(!approval)throw new InstagramError('APPROVAL_NOT_FOUND',404);
   let job=await checked(one('instagram_jobs',req.seller).eq('approval_id',approval.id).maybeSingle());
   if(job&&job.state!=='processing')return res.status(job.state==='published'?200:202).json(cleanJob(job));
   const c=await connection(req.seller);
   if(job&&job.account_id!==c.account_id)throw new InstagramError('ACCOUNT_CHANGED',409);
   if(!job){
    const insert=await db.from('instagram_jobs').insert({id:randomUUID(),seller_id:req.seller,approval_id:approval.id,account_id:c.account_id,state:'queued'}).select('*').single();
    if(insert.error){job=await checked(one('instagram_jobs',req.seller).eq('approval_id',approval.id).maybeSingle());if(!job)throw new InstagramError('INSTAGRAM_STORAGE_UNAVAILABLE',503);return res.status(202).json(cleanJob(job))}
    job=insert.data;
    try{
     const signed=await checked(db.storage.from('instagram-approved').createSignedUrl(approval.image_path,3600));
     if(!signed?.signedUrl?.startsWith(config.url+'/storage/v1/'))throw new InstagramError('INVALID_MEDIA_URL',503);
     const container=await provider.create(c.account_id,c.token,signed.signedUrl,approval.caption);
     if(!/^\d+$/.test(String(container.id||'')))throw new InstagramError('INVALID_META_RESPONSE');
     job=await update(job,{state:'processing',container_id:String(container.id)});
    }catch(e){job=await update(job,{state:'failed',error_code:e instanceof InstagramError?e.code:'INSTAGRAM_UNAVAILABLE'});return res.status(502).json(cleanJob(job))}
   }
   const status=await provider.container(job.container_id,c.token);
   if(['ERROR','EXPIRED'].includes(status.status_code)){
    const failed=await checked(db.from('instagram_jobs').update({state:'failed',error_code:'CONTAINER_FAILED',updated_at:new Date().toISOString()}).eq('id',job.id).eq('seller_id',req.seller).eq('state','processing').select('*'));
    job=failed[0]||await checked(one('instagram_jobs',req.seller).eq('id',job.id).single());return res.status(job.state==='failed'?502:202).json(cleanJob(job));
   }
   if(status.status_code!=='FINISHED')return res.status(202).json(cleanJob(job));
   // Atomic compare-and-set ensures only one request may send media_publish.
   const claimed=await checked(db.from('instagram_jobs').update({state:'publishing',updated_at:new Date().toISOString()}).eq('id',job.id).eq('seller_id',req.seller).eq('state','processing').select('*'));
   if(!claimed.length)return res.status(202).json(cleanJob(await checked(one('instagram_jobs',req.seller).eq('id',job.id).single())));
   job=claimed[0];
   try{
    const published=await provider.publish(c.account_id,c.token,job.container_id);
    if(!/^\d+$/.test(String(published.id||'')))throw new InstagramError('META_RESPONSE_UNCERTAIN',504);
    // A returned media ID confirms publication; permalink enrichment is optional.
    job=await update(job,{state:'published',media_id:String(published.id)});
   }catch{
    // Keep publishing on any ambiguous result. Never automatically resend publication.
    job=await update(job,{error_code:'PUBLISH_OUTCOME_UNKNOWN'});return res.status(202).json(cleanJob(job));
   }
   res.json(cleanJob(job));
  }));
  router.get('/jobs/:id',safe(async(req,res)=>{if(!uuid(req.params.id))throw new InstagramError('JOB_NOT_FOUND',404);const job=await checked(one('instagram_jobs',req.seller).eq('id',req.params.id).maybeSingle());if(!job)throw new InstagramError('JOB_NOT_FOUND',404);res.json(cleanJob(job))}));
  app.use('/api/instagram',router);
 }
 return {installCallback,installRoutes};
}
