export const permissions=['instagram_business_basic','instagram_business_content_publish'];
export class InstagramError extends Error {
 constructor(code,status=502){super(code);this.code=code;this.status=status}
}
export function instagramConfig(env=process.env){
 const names=['INSTAGRAM_APP_ID','INSTAGRAM_APP_SECRET','INSTAGRAM_REDIRECT_URI','INSTAGRAM_API_VERSION','INSTAGRAM_TOKEN_ENCRYPTION_KEY','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'];
 const missing=names.filter(k=>!env[k]);
 const validURL=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash}catch{return false}};
 const valid=validURL(env.INSTAGRAM_REDIRECT_URI)&&new URL(env.INSTAGRAM_REDIRECT_URI).pathname==='/auth/instagram/callback'&&validURL(env.SUPABASE_URL)&&/^v\d+\.\d+$/.test(env.INSTAGRAM_API_VERSION||'')&&/^[a-f\d]{64}$/i.test(env.INSTAGRAM_TOKEN_ENCRYPTION_KEY||'');
 return {configured:!missing.length&&valid,missing,appId:env.INSTAGRAM_APP_ID,secret:env.INSTAGRAM_APP_SECRET,redirect:env.INSTAGRAM_REDIRECT_URI,version:env.INSTAGRAM_API_VERSION,key:env.INSTAGRAM_TOKEN_ENCRYPTION_KEY,url:env.SUPABASE_URL,serviceKey:env.SUPABASE_SERVICE_ROLE_KEY};
}
export function createInstagramProvider(config,fetcher=fetch){
 async function request(url,{method='GET',body,token}={}){
  try{
   const r=await fetcher(url,{method,headers:token?{Authorization:'Bearer '+token}:undefined,body,signal:AbortSignal.timeout(15000),redirect:'error'});
   const data=await r.json();
   if(!r.ok||data.error){const code=data.error?.code;throw new InstagramError(code===190?'RECONNECT_REQUIRED':code===10||code===200?'PERMISSION_REQUIRED':'META_REQUEST_FAILED',code===190||code===10||code===200?409:502)}
   return data;
  }catch(e){if(e instanceof InstagramError)throw e;throw new InstagramError('META_RESPONSE_UNCERTAIN',504)}
 }
 const graph=(path,token,body)=>request(`https://graph.instagram.com/${config.version}/${path}`,{token,method:body?'POST':'GET',body:body?new URLSearchParams(body):undefined});
 return {
  authorize(state){const url=new URL('https://www.instagram.com/oauth/authorize');url.search=new URLSearchParams({client_id:config.appId,redirect_uri:config.redirect,response_type:'code',scope:permissions.join(','),state,enable_fb_login:'0',force_authentication:'1'});return url.href},
  async exchange(code){
   const form=new FormData();for(const [k,v]of Object.entries({client_id:config.appId,client_secret:config.secret,grant_type:'authorization_code',redirect_uri:config.redirect,code}))form.set(k,v);
   const short=await request('https://api.instagram.com/oauth/access_token',{method:'POST',body:form});
   if(typeof short.access_token!=='string')throw new InstagramError('INVALID_META_RESPONSE');
   const url=new URL('https://graph.instagram.com/access_token');url.search=new URLSearchParams({grant_type:'ig_exchange_token',client_secret:config.secret,access_token:short.access_token});
   const long=await request(url);if(typeof long.access_token!=='string'||!Number.isFinite(long.expires_in)||long.expires_in<=0)throw new InstagramError('INVALID_META_RESPONSE');
   return {token:long.access_token,expiresAt:new Date(Date.now()+long.expires_in*1000).toISOString()};
  },
  async identity(token){
   const who=await graph('me?fields=user_id,username,account_type',token);
   if(!/^\d+$/.test(String(who.user_id||''))||!['BUSINESS','MEDIA_CREATOR'].includes(who.account_type))throw new InstagramError('PROFESSIONAL_ACCOUNT_REQUIRED',409);
   const grants=await graph('me/permissions',token);
   if(!permissions.every(p=>grants.data?.some(x=>x.permission===p&&x.status==='granted')))throw new InstagramError('PERMISSION_REQUIRED',409);
   return {account_id:String(who.user_id),username:String(who.username||''),permissions:[...permissions]};
  },
  create:(id,token,url,caption)=>graph(`${id}/media`,token,{image_url:url,caption}),
  container:(id,token)=>graph(`${id}?fields=status_code`,token),
  publish:(id,token,container)=>graph(`${id}/media_publish`,token,{creation_id:container}),
  media:(id,token)=>graph(`${id}?fields=id,permalink`,token)
 };
}
