/* Provider-neutral boundary. Production has no authorized adapter configured yet. */
export const verificationKinds=['identity','business','gst'];
export function gstFormatValid(value){return typeof value==='string'&&/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(value)}
export function udyamFormatValid(value){return typeof value==='string'&&/^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/.test(value.trim().toUpperCase())}
export const verificationStatuses=['not_started','in_progress','pending','pending_review','verified','action_required','rejected','failed','setup_required','not_applicable'];
export function safeBusinessDetails(input={}){
 const allowed=['legal_name','business_name','business_type','state','address','gstin','udyam_number','consent'];
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!allowed.includes(k)))throw Error('Invalid business details');
 const value={};for(const key of allowed)if(key!=='consent'&&input[key]!=null){if(typeof input[key]!=='string'||input[key].length>300)throw Error('Invalid business details');value[key]=input[key].trim()}
 if(input.consent!==true)throw Error('Verification consent is required');
 if(value.gstin&&!gstFormatValid(value.gstin))throw Error('Check the GSTIN format');
 if(value.udyam_number&&!udyamFormatValid(value.udyam_number))throw Error('Check the Udyam number format');
 return value;
}
export function providerResult(result,{kind}){
 if(!result||typeof result!=='object'||!verificationStatuses.includes(result.status))throw Error('Invalid provider response');
 if(result.status==='verified'&&(!result.reference||!result.checkedAt))throw Error('Missing authoritative verification evidence');
 return {kind,status:result.status,provider_reference:result.reference||null,verified_at:result.status==='verified'?result.checkedAt:null,masked_identifier:result.maskedIdentifier||null,reason:result.reason||null};
}
export async function requestVerification({kind,consent,details},authorizedAdapter){
 if(!verificationKinds.includes(kind))throw Error('Invalid verification type');
 if(!authorizedAdapter)return {status:'not_started',setup_required:true};
 if(consent!==true)throw Error('Consent required');
 if(kind==='gst'&&!gstFormatValid(details?.gstin))throw Error('Check GSTIN format');
 const result=await authorizedAdapter.verify({kind,details});
 if(!['pending','verified','rejected','action_required','expired'].includes(result.status))throw Error('Invalid provider response');
 if(result.status==='verified'&&(!result.reference||!result.checkedAt))throw Error('Missing authoritative verification evidence');
 if(kind==='gst'&&result.status==='verified'&&(result.registrationStatus!=='active'||result.nameMatch!==true))return {status:'action_required',reason:'Registration status or business-name match requires review.'};
 return {kind,status:result.status,provider_reference:result.reference||null,verified_at:result.status==='verified'?result.checkedAt:null,masked_identifier:result.maskedIdentifier||null};
}
