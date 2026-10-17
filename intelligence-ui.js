let socialDraft=null,socialSequence=0,socialController=null,socialDirty=false,socialContextStale=false;
const socialFields=['instagram_caption','hashtags','marketplace_description','whatsapp_message','voice_ad','alternative_captions'];
function invalidateSocial(){socialSequence++;socialController?.abort();socialController=null;socialDraft=null;socialDirty=false;socialContextStale=false;$('socialApproved').checked=false;$('instagramFinalApproval').checked=false;$('socialPanel').hidden=true;$('generateSocial').disabled=false;}
function approvedSocialPrice(){return $('socialIncludePrice').checked&&$('priceApproved').checked&&priceValid()?`${$('p_currency').value} ${Number($('price').value).toFixed(2)}`:''}
function socialExport(){if(!socialDraft)return null;const value={...socialDraft,...Object.fromEntries(socialFields.map(k=>[k,['hashtags','alternative_captions'].includes(k)?$('social_'+k).value.split('\n').filter(Boolean):$('social_'+k).value])),review_status:$('socialApproved').checked?'approved':'pending'};const price=approvedSocialPrice();if(price)for(const k of ['instagram_caption','whatsapp_message','voice_ad'])value[k]+='\n'+price;return value;}
function markSocialContextChanged(){socialSequence++;socialController?.abort();$('generateSocial').disabled=false;if(!socialDraft)return;socialContextStale=true;$('socialApproved').checked=false;$('instagramFinalApproval').checked=false;$('confirmed').checked=false;$('socialIncludePrice').checked=false;$('socialSource').textContent='Listing changed. Your draft edits are preserved; review them against the updated product before sharing.';updateInstagramPreview();}

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
 if(socialDraft&&(socialDirty||socialContextStale)&&!window.confirm('Replace your existing edited marketing draft? Cancel keeps your edits.'))return;
 const previousDraft=socialDraft;const previousValues=Object.fromEntries(socialFields.map(k=>[k,$('social_'+k).value]));
 socialSequence++;socialController?.abort();const request=++socialSequence,controller=new AbortController();socialController=controller;const timeout=setTimeout(()=>controller.abort(),requestTimeoutMs);$('generateSocial').disabled=true;$('socialGenerationStatus').textContent='Generating your sharing draft… Existing edits are kept until a new response succeeds.';
 let result;const input={title:$('title').value,description:$('description').value,language:$('language').value,reviewed:true};
 try{
  const response=await fetch('/api/marketing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:controller.signal});if(!response.ok)throw Error('unavailable');result=await response.json();
 }catch{
  if(previousDraft){if(request===socialSequence){socialDraft=previousDraft;for(const k of socialFields)$('social_'+k).value=previousValues[k];$('socialGenerationStatus').textContent='Generation failed; previous draft kept.';$('socialSource').textContent='Regeneration failed. Your previous draft and edits are preserved.';$('generateSocial').disabled=false;}return}
  const w=words[input.language];result={language:input.language,instagram_caption:input.title+'. '+w[0],hashtags:[],marketplace_description:input.description,whatsapp_message:input.title+'. '+w[1],voice_ad:input.title+'. '+w[0]+' '+w[1],alternative_captions:[input.title+'. '+w[1]],source:'local_template_backend_unavailable',review_status:'pending'};
 }finally{clearTimeout(timeout)}
 if(request!==socialSequence)return;socialDraft=result;socialDirty=false;socialContextStale=false;$('socialApproved').checked=false;$('instagramFinalApproval').checked=false;

 for(const k of socialFields)$('social_'+k).value=Array.isArray(socialDraft[k])?socialDraft[k].join('\n'):socialDraft[k]||'';
 $('socialSource').textContent='Source: '+socialDraft.source+' · translation and claims require your review. Instagram publishing is not connected.';
 $('socialPanel').hidden=false;$('generateSocial').disabled=false;$('socialGenerationStatus').textContent=socialDraft.source==='gemini'?'Draft generated. Review the translation and claims.':'AI unavailable. A local template is ready for editing.';$('confirmed').checked=false;updateInstagramPreview();if(typeof saveDraft==='function')void saveDraft();
};
function instagramDraftText(){return [(socialExport()?.instagram_caption||'').trim(),$('social_hashtags').value.trim().split(/\s+/).filter(Boolean).join(' ')].filter(Boolean).join('\n');}
function updateInstagramPreview(){const text=instagramDraftText();$('instagramPreviewCaption').textContent=text;const tags=$('social_hashtags').value.trim().split(/\s+/).filter(Boolean);const count=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text)].length:[...text].length;$('instagramCount').textContent=`${count} characters including hashtags and any approved price · ${tags.length} tags. ${tags.some(t=>!t.startsWith('#'))?'Start each hashtag with #. ':''}Guidance only; media and current Instagram API requirements still need validation.`;if(photoURL){$('instagramPreviewPhoto').src=photoURL;$('instagramPreviewPhoto').hidden=false}else $('instagramPreviewPhoto').hidden=true;}

for(const k of socialFields)$('social_'+k).addEventListener('input',()=>{socialDirty=true;$('socialApproved').checked=false;$('instagramFinalApproval').checked=false;$('confirmed').checked=false;updateInstagramPreview()});
for(const k of ['title','description','material','condition','price','category','notes','language','p_currency','priceApproved'])$(k).addEventListener('input',markSocialContextChanged);
$('socialApproved').onchange=()=>{$('instagramFinalApproval').checked=false;$('confirmed').checked=false};
function shareReady(){if(!socialDraft||!$('socialApproved').checked||!$('confirmed').checked){toast('Approve the edited marketing and final listing before sharing.');return false}return true}
$('copyInstagram').onclick=async()=>{if(!shareReady())return;try{await navigator.clipboard.writeText(instagramDraftText());toast('Instagram caption copied.')}catch{toast('Clipboard unavailable. Select and copy the caption.')}};
$('shareWhatsApp').onclick=()=>{if(shareReady())window.open('https://wa.me/?text='+encodeURIComponent(instagramDraftText()),'_blank','noopener,noreferrer')};
$('downloadMarketing').onclick=()=>{if(!shareReady())return;try{const url=URL.createObjectURL(new Blob([JSON.stringify(socialExport(),null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='dukaan-marketing-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Draft export requested. Check your browser downloads.');}catch{toast('Draft export could not start. Your edits are unchanged.');}};
$('useSocialVoice').onclick=()=>{if(!shareReady())return;$('ad').value=socialExport().voice_ad;$('confirmed').checked=false;toast('Voice script applied. Review the listing again before playback.');};

$('socialIncludePrice').onchange=()=>{if($('socialIncludePrice').checked&&(!$('priceApproved').checked||!priceValid())){$('socialIncludePrice').checked=false;toast('Approve a valid seller price first.');}socialDirty=true;$('socialApproved').checked=false;$('instagramFinalApproval').checked=false;$('confirmed').checked=false;updateInstagramPreview();};
$('downloadCreative').onclick=()=>{if(!shareReady())return;if(!currentFile){toast('No product image is available. Upload a photo first.');return}try{const url=URL.createObjectURL(currentFile);const a=document.createElement('a');a.href=url;a.download=currentFile.name||'product-photo.jpg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Image download requested. Check your browser downloads.');}catch{toast('Image download could not start. Your draft is unchanged.');}};
$('postInstagram').onclick=async()=>{if(!shareReady())return;if(!currentFile||!$('instagramFinalApproval').checked){toast('Review the actual photo and approve the final Instagram post first.');return}if(!instagramDraftText().trim()){toast('Add a caption before publishing.');return}$('postInstagram').disabled=true;$('instagramStatus').textContent='Checking publishing availability…';try{const r=await fetch('/api/instagram/publish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({approved:true})});const result=await r.json();$('instagramStatus').textContent=result.error?.message||'Publishing was not confirmed. Your draft remains available.';}catch{$('instagramStatus').textContent='Publishing unavailable. Use copy, image download, draft export or WhatsApp.'}finally{$('postInstagram').disabled=false}};

async function refreshIntegrationStatus(){
 $('refreshInstagramStatus').disabled=true;
 try{const r=await fetch('/api/integrations');if(!r.ok)throw Error('unavailable');const status=await r.json();$('instagramStatus').textContent=status.instagram.message;
 const labels={INSTAGRAM_ACCOUNT_ID:'Instagram professional account ID',INSTAGRAM_ACCESS_TOKEN:'Authorized Instagram access token',INSTAGRAM_API_VERSION:'Supported Meta API version'};
 const lines=[...status.instagram.missing.map(k=>'Missing: '+(labels[k]||k)), 'Required: a Business or Creator account, Meta app authorization and content-publishing permissions.', 'Remaining implementation: authorized media hosting and an official publishing adapter with confirmed publication responses.', 'Configuration presence alone does not prove account access or publishing permission.'];
 $('instagramSetupDetails').replaceChildren(...lines.map(line=>textElement('p',line)));
 $('cloudStatus').textContent=`Gemini route: ${status.gemini.provider}. Cloud Storage: ${status.storage.state}. BigQuery: ${status.bigquery.state}. Vertex AI: ${status.vertex.state}.`;
 }catch{$('instagramStatus').textContent='Connection status unavailable. Draft editing, downloads and exports remain available.';}finally{$('refreshInstagramStatus').disabled=false}
}
$('refreshInstagramStatus').onclick=refreshIntegrationStatus;
