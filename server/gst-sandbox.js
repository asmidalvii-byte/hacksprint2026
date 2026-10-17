import {gstFormatValid} from './verification.js';

const host='https://test-api.sandbox.co.in';
const failure=(code,message,status=503)=>Object.assign(new Error(message),{code,status});
export function gstSandboxConfig(env=process.env){
 const apiKey=env.GST_SANDBOX_API_KEY?.trim()||'';
 const apiSecret=env.GST_SANDBOX_API_SECRET?.trim()||'';
 return {enabled:env.GST_SANDBOX_ENABLED==='true',apiKey,apiSecret};
}

// This adapter intentionally has no production host and no database writer.
export function createGstSandbox({settings=gstSandboxConfig(),fetchImpl=fetch}={}){
 return async function lookup(input){
  if(!settings.enabled||!settings.apiKey||!settings.apiSecret)throw failure('GST_SANDBOX_SETUP_REQUIRED','Configure Sandbox.co.in test API credentials on the server.');
  if(!input||Array.isArray(input)||Object.keys(input).some(k=>!['gstin','consent','legal_name'].includes(k)))throw failure('INVALID_GST_SANDBOX_INPUT','Supply a test GSTIN, consent and optional legal name.',400);
  const gstin=typeof input.gstin==='string'?input.gstin.trim().toUpperCase():'';
  if(!gstFormatValid(gstin))throw failure('INVALID_GST_FORMAT','Check the GSTIN format.',400);
  if(input.consent!==true)throw failure('GST_SANDBOX_CONSENT_REQUIRED','Consent is required to send this test GSTIN to Sandbox.co.in.',400);
  if(input.legal_name!=null&&(typeof input.legal_name!=='string'||input.legal_name.length>300))throw failure('INVALID_GST_SANDBOX_INPUT','Check the legal business name.',400);
  const signal=AbortSignal.timeout(15000);
  async function post(path,headers,body){
   let response,payload;
   try{
    response=await fetchImpl(host+path,{method:'POST',redirect:'error',signal,headers:{'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});
    if([401,403].includes(response.status))throw failure('GST_SANDBOX_AUTH_FAILED','Sandbox credentials or API access were rejected.');
    if(response.status===429)throw failure('GST_SANDBOX_RATE_LIMITED','Sandbox rate limit reached. Retry later.',429);
    if(!response.ok)throw failure('GST_SANDBOX_UNAVAILABLE','The GST sandbox request failed. Retry later.');
    payload=await response.json();
   }catch(error){
    if(error.code?.startsWith('GST_SANDBOX_'))throw error;
    throw failure(signal.aborted?'GST_SANDBOX_TIMEOUT':'GST_SANDBOX_UNAVAILABLE','The GST sandbox could not return a usable response. Retry later.');
   }
   if(payload?.code!==200)throw failure('GST_SANDBOX_INVALID_RESPONSE','The GST sandbox did not return a successful result.');
   return payload;
  }
  const auth=await post('/authenticate',{'x-api-key':settings.apiKey,'x-api-secret':settings.apiSecret});
  const token=auth.data?.access_token;
  if(typeof token!=='string'||!token||token.length>16000)throw failure('GST_SANDBOX_INVALID_RESPONSE','Sandbox authentication returned an incomplete response.');
  const response=await post('/gst/compliance/public/gstin/search',{'x-api-key':settings.apiKey,authorization:token,'x-accept-cache':'false'},{gstin});
  const result=response.data?.data;
  // Embedded provider errors and no-record responses must never look successful.
  if(response.data?.status_cd!=='1'||!result||result.gstin!==gstin||typeof result.lgnm!=='string'||!result.lgnm.trim()||result.lgnm.length>300||typeof result.sts!=='string'||!result.sts.trim()||result.sts.length>100||typeof response.transaction_id!=='string'||!response.transaction_id||response.transaction_id.length>200)throw failure('GST_SANDBOX_INCOMPLETE_RESULT','No complete matching GST record was returned by the sandbox.');
  const normalized=value=>value.trim().replace(/\s+/g,' ').toLocaleUpperCase('en-IN');
  const nameMatch=input.legal_name?.trim()?normalized(input.legal_name)===normalized(result.lgnm):null;
  return {success:true,demo:true,environment:'test',provider:'sandbox.co.in',authoritative:false,notice:'Sandbox API test result only. This does not verify a real seller or grant application access.',data:{status:'sandbox_result',access_allowed:false,registration_status:result.sts,legal_name:result.lgnm,masked_gstin:gstin.slice(0,2)+'***********'+gstin.slice(-2),active:result.sts==='Active',name_match:nameMatch,name_match_method:nameMatch===null?null:'normalized_exact',provider_reference:response.transaction_id,checked_at:new Date().toISOString(),next_action:'review_sandbox_result'}};
 };
}
