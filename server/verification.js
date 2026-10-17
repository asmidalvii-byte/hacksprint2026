/* Provider-neutral boundary. Production has no authorized adapter configured yet. */
export const verificationKinds=['identity','business','gst'];
export function gstFormatValid(value){return typeof value==='string'&&/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(value)}
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
