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
 value.consent=true;
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

// Overall approval and registration evidence are distinct, trusted records.
export function businessAccess(records,now=Date.now()) {
 const business=Array.isArray(records)?records.find(r=>r.kind==='business'):null;
 const current=r=>r?.status==='verified' && typeof r.provider_reference==='string' && r.provider_reference.trim().length>0 && Number.isFinite(Date.parse(r.verified_at)) && Date.parse(r.verified_at)<=now && (r.expires_at==null || Date.parse(r.expires_at)>now);
 if(current(business)&&records.some(r=>['udyam','gst'].includes(r.kind)&&current(r)))return {allowed:true,business_status:'verified',next_action:'enter_dashboard'};
 const actions={not_started:'start_verification',in_progress:'continue_verification',pending_review:'wait_for_review',pending:'wait_for_review',action_required:'correct_information',rejected:'contact_support',failed:'retry_verification',setup_required:'provider_setup',not_applicable:'contact_support',expired:'renew_verification'};
 const status=business?.status==='verified'?'action_required':Object.hasOwn(actions,business?.status)?business.status:'not_started';
 return {allowed:false,code:'BUSINESS_VERIFICATION_REQUIRED',business_status:status,next_action:actions[status],message:status==='action_required'?'Current authoritative business and Udyam or GST verification are required.':`Business verification status: ${status}.`};
}
