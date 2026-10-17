let socialDraft=null,socialSequence=0,socialController=null;
const socialFields=['instagram_caption','hashtags','marketplace_description','whatsapp_message','voice_ad','alternative_captions'];
function invalidateSocial(){socialSequence++;socialController?.abort();socialController=null;socialDraft=null;$('socialApproved').checked=false;$('socialPanel').hidden=true;$('generateSocial').disabled=false;}
function socialExport(){if(!socialDraft)return null;return {...socialDraft,...Object.fromEntries(socialFields.map(k=>[k,['hashtags','alternative_captions'].includes(k)?$('social_'+k).value.split('\n').filter(Boolean):$('social_'+k).value])),review_status:$('socialApproved').checked?'approved':'pending'}}
function renderIntelligence(){
 const data=analysis?.intelligence,box=$('intelligenceDetails');box.replaceChildren();if(!data)return;
 const hypotheses=data.material_hypotheses.map(h=>`${h.material_name}: ${h.likelihood_label} (${h.confidence} confidence). Alternatives: ${h.alternative_explanations.join('; ')}. Verify: ${h.verification_method}`);
 box.append(textElement('p','Material suggestions are hypotheses, not confirmed composition. They never set material or price.'));
 for(const h of hypotheses)box.append(textElement('p',h));
 for(const q of data.seller_questions)box.append(textElement('p',q.priority+': '+q.question));
 for(const [key,value]of Object.entries(data)){
  const details=document.createElement('details');details.append(textElement('summary',key.replaceAll('_',' ')),textElement('pre',JSON.stringify(value,null,2)));box.append(details);
 }
}
$('generateSocial').onclick=async()=>{
 if(!$('confirmed').checked){toast('Review and approve the listing before generating marketing.');return}
 invalidateSocial();const request=++socialSequence,controller=new AbortController();socialController=controller;const timeout=setTimeout(()=>controller.abort(),requestTimeoutMs);$('generateSocial').disabled=true;
 let result;const input={title:$('title').value,description:$('description').value,language:$('language').value,reviewed:true};
 try{
  const response=await fetch('/api/marketing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:controller.signal});if(!response.ok)throw Error('unavailable');result=await response.json();
 }catch{
  const w=words[input.language];result={language:input.language,instagram_caption:input.title+'. '+w[0],hashtags:[],marketplace_description:input.description,whatsapp_message:input.title+'. '+w[1],voice_ad:input.title+'. '+w[0]+' '+w[1],alternative_captions:[input.title+'. '+w[1]],source:'local_template_backend_unavailable',review_status:'pending'};
 }finally{clearTimeout(timeout)}
 if(request!==socialSequence)return;socialDraft=result;
 if($('priceApproved').checked&&priceValid())for(const k of ['instagram_caption','whatsapp_message','voice_ad'])socialDraft[k]+=` ${$('p_currency').value} ${Number($('price').value).toFixed(2)}.`;
 for(const k of socialFields)$('social_'+k).value=Array.isArray(socialDraft[k])?socialDraft[k].join('\n'):socialDraft[k]||'';
 $('socialSource').textContent='Source: '+socialDraft.source+' · translation and claims require your review. Instagram publishing is not connected.';
 $('socialPanel').hidden=false;$('generateSocial').disabled=false;$('confirmed').checked=false;updateInstagramPreview();
};
function updateInstagramPreview(){$('instagramPreviewCaption').textContent=$('social_instagram_caption').value+'\n'+$('social_hashtags').value;if(photoURL){$('instagramPreviewPhoto').src=photoURL;$('instagramPreviewPhoto').hidden=false}else $('instagramPreviewPhoto').hidden=true;}
for(const k of socialFields)$('social_'+k).addEventListener('input',()=>{$('socialApproved').checked=false;$('confirmed').checked=false;updateInstagramPreview()});
for(const k of ['title','description','material','condition','price','category','notes','language','p_currency','priceApproved'])$(k).addEventListener('input',invalidateSocial);
$('socialApproved').onchange=()=>{$('confirmed').checked=false};
function shareReady(){if(!socialDraft||!$('socialApproved').checked||!$('confirmed').checked){toast('Approve the edited marketing and final listing before sharing.');return false}return true}
$('copyInstagram').onclick=async()=>{if(!shareReady())return;try{await navigator.clipboard.writeText($('social_instagram_caption').value+'\n'+$('social_hashtags').value);toast('Instagram caption copied.')}catch{toast('Clipboard unavailable. Select and copy the caption.')}};
$('shareWhatsApp').onclick=()=>{if(shareReady())window.open('https://wa.me/?text='+encodeURIComponent($('social_whatsapp_message').value),'_blank','noopener,noreferrer')};
$('downloadMarketing').onclick=()=>{if(!shareReady())return;const url=URL.createObjectURL(new Blob([JSON.stringify(socialExport(),null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='dukaan-marketing-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
$('useSocialVoice').onclick=()=>{if(!shareReady())return;$('ad').value=$('social_voice_ad').value;$('confirmed').checked=false;toast('Voice script applied. Review the listing again before playback.');};
