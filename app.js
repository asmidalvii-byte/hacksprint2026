const $=id=>document.getElementById(id);let ready=false,photoURL=null,sample=false,timer;
let currentFile=null, productVersion=0, requestSequence=0, uploadSequence=0, analysisController=null, analysis=null, appliedAnalysis=null, acceptedFields=[], draftSource="sample", requestTimeoutMs=45000;
const samples={saree:['Saree for everyday celebrations','A saree to style for everyday moments and special occasions. Confirm the fabric, dimensions, care instructions and available colours with the seller.'],pot:['Decorative pottery for your home','Bring a personal touch to your space with this pottery piece. Confirm the material, dimensions, finish and intended use with the seller.'],jewelry:['An accessory for your everyday style','Complete your look with this accessory. Confirm the material, measurements, finish and care instructions with the seller.'],other:['A special find from your local shop','Discover a product from your local merchant. Confirm the material, dimensions, condition and care instructions before ordering.']};
const words={en:["Discover something special from your local seller.","Contact us for details and orders.","Price","rupees"],hi:['अपने पसंदीदा स्थानीय दुकानदार से कुछ खास खरीदें।','जानकारी और ऑर्डर के लिए हमसे संपर्क करें।','कीमत','रुपये'],ta:['உங்கள் உள்ளூர் கடையில் சிறப்பான பொருளை வாங்குங்கள்.','விவரங்களுக்கும் ஆர்டர் செய்யவும் எங்களைத் தொடர்பு கொள்ளுங்கள்.','விலை','ரூபாய்'],te:['మీ స్థానిక దుకాణంలో ప్రత్యేకమైన వస్తువును కొనండి.','వివరాలు మరియు ఆర్డర్ కోసం మమ్మల్ని సంప్రదించండి.','ధర','రూపాయలు'],kn:['ನಿಮ್ಮ ಸ್ಥಳೀಯ ಅಂಗಡಿಯಿಂದ ವಿಶೇಷವಾದ ವಸ್ತುವನ್ನು ಖರೀದಿಸಿ.','ವಿವರಗಳು ಮತ್ತು ಆರ್ಡರ್‌ಗಾಗಿ ನಮ್ಮನ್ನು ಸಂಪರ್ಕಿಸಿ.','ಬೆಲೆ','ರೂಪಾಯಿ'],bn:['আপনার স্থানীয় দোকান থেকে বিশেষ কিছু কিনুন।','বিস্তারিত জানতে এবং অর্ডার করতে আমাদের সঙ্গে যোগাযোগ করুন।','দাম','টাকা']};
function toast(s){$('toast').textContent=s;$('toast').hidden=false;clearTimeout(timer);timer=setTimeout(()=>$('toast').hidden=true,4500)}
function i18nText(key,fallback){try{return window.DukaanI18n?DukaanI18n.get(window.DukaanScreens?.currentLang()||'en',key):fallback}catch{return fallback}}
function i18nLabel(key,fallback){return '▶ '+i18nText(key,fallback.replace(/^▶\s*/,''))}
function stop(){window.speechSynthesis?.cancel();$('play').textContent=i18nLabel('playPreviewBtn','▶ Play voice preview');$('stop').disabled=true;$('sarvamAudio').pause?.()}
function priceValid(){const p=$('price');return p.value!==''&&p.validity.valid&&Number(p.value)>0}
function makeAd(){if(!ready)return;stop();const w=words[$('language').value],priced=$('includePrice').checked&&priceValid()&&$('priceApproved').checked;$('ad').value=[$('title').value+'.',w[0],priced?`${w[2]} ${Number($('price').value).toLocaleString('en-IN')} ${$('p_currency').value==='INR'?w[3]:$('p_currency').value}.`:'',w[1]].filter(Boolean).join(' ');$('priceStatus').textContent=priced?'Merchant-entered price included':'No price in this ad';$('voiceStatus').textContent='Template ad: the product title stays as written. You can edit the script.'}
async function upload(file){if(!file)return;const uploadId=++uploadSequence;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024){toast('Choose a JPG, PNG or WebP image under 10 MB.');return}const next=URL.createObjectURL(file),img=new Image();try{await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=next})}catch{URL.revokeObjectURL(next);toast('This image could not be opened. Try another photo.');return}if(uploadId!==uploadSequence){URL.revokeObjectURL(next);return}newProduct();currentFile=file;$('file').value='';if(photoURL)URL.revokeObjectURL(photoURL);photoURL=next;sample=false;$('preview').src=next;$('preview').hidden=false;$('uploadIcon').hidden=true;$('uploadLabel').textContent=file.name;$('uploadHelp').textContent=i18nText('replacePhoto','Click to replace photo');resetDraft();toast('Photo added. Choose a category and create your draft.');if(typeof saveDraft==='function')void saveDraft()}
function resetDraft(){stop();ready=false;$('listing').hidden=true;$('empty').hidden=false;$('draftTag').textContent=i18nText('awaitingDraft','AWAITING DRAFT');$('ad').value='';$('ad').disabled=true;['play','copy','sarvamPlay','reportListen'].forEach(x=>$(x).disabled=true);$('sarvamAudio').hidden=true;$('sarvamAudio').src='';$('reportAudio').hidden=true;$('reportAudio').src='';$('confirmed').checked=false;$('voiceStatus').textContent='';$('reportListenStatus').textContent='';$('priceStatus').textContent=i18nText('priceStaysDefault','Price stays in your hands')}
$('drop').onclick=()=>$('file').click();$('file').onchange=e=>upload(e.target.files[0]);$('drop').ondragover=e=>{e.preventDefault();$('drop').classList.add('drag')};$('drop').ondragleave=()=>$('drop').classList.remove('drag');$('drop').ondrop=e=>{e.preventDefault();$('drop').classList.remove('drag');upload(e.dataTransfer.files[0])};
function showEditor(){ready=true;$('listing').hidden=false;$('empty').hidden=true;$('draftTag').textContent=i18nText('editableDraft','EDITABLE DRAFT');$('ad').disabled=false;['play','copy','sarvamPlay','reportListen'].forEach(x=>$(x).disabled=false);window.DukaanScreens?.show('screen-report')}
function generate(){
  if(!photoURL&&!sample){toast('Add a product photo or try the sample saree.');return}
  if(typeof invalidateSocial==='function')invalidateSocial();invalidatePricing();const d=samples[$('category').value];
  // Sample generation for this product preserves merchant-entered price and facts.
  $('title').value=d[0];$('description').value=d[1];$('confirmed').checked=false;
  analysis=null;appliedAnalysis=null;acceptedFields=[];draftSource='sample';$('analysisPanel').hidden=true;
  $('listingNotice').textContent='Sample draft · Image not analyzed. Review every detail.';
  showEditor();makeAd();toast('Sample draft created. Your selling price is preserved.');
}
$('generate').onclick=analyzePhoto;
$('fallback').onclick=()=>{
  if(ready&&!window.confirm('Replace the title and description with sample copy? Your price, material and condition will be kept.'))return;
  cancelAnalysis();generate();
};
$('sample').onclick=()=>{
  if(ready&&!window.confirm('Start a new sample product? This clears the current listing and its price.'))return;
  ++uploadSequence;newProduct();if(photoURL){URL.revokeObjectURL(photoURL);photoURL=null}
  sample=true;$('preview').hidden=true;$('uploadIcon').hidden=false;$('uploadLabel').textContent=i18nText('sampleSareeSelected','Sample saree selected');$('uploadHelp').textContent=i18nText('sampleScenarioNote','Sample scenario · no image analysis');$('category').value='saree';generate();
};
$('category').onchange=()=>{cancelAnalysis();$('confirmed').checked=false;acceptedFields=acceptedFields.filter(x=>x!=='category');if(analysis){analysis=null;$('analysisPanel').hidden=true;toast('Category changed. Analyze again for fresh suggestions.')}};
['title','description','material','condition','price'].forEach(id=>$(id).addEventListener('input',()=>{if(id!=='price')$('confirmed').checked=false;acceptedFields=acceptedFields.filter(x=>x!==id);if(['title','price'].includes(id))makeAd()}));$('includePrice').onchange=()=>{if($('includePrice').checked&&!priceValid()){$('includePrice').checked=false;toast('Enter a valid selling price first.')} makeAd()};$('language').onchange=()=>{makeAd()};$('ad').oninput=()=>{stop()};$('listing').onsubmit=e=>e.preventDefault();
$('play').onclick=()=>{if(!$('confirmed').checked){toast('Review the details and check the confirmation box before playback.');return}if(!window.speechSynthesis){$('voiceStatus').textContent='Voice playback is unavailable in this browser. You can copy the script.';return}const lang=$('language').value,voice=speechSynthesis.getVoices().find(v=>v.lang.toLowerCase().startsWith(lang));if(!voice){$('voiceStatus').textContent='No matching voice is installed on this device. Install a voice for this language in device settings, or copy the script. Sarvam is not connected.';return}stop();const utterance=new SpeechSynthesisUtterance($('ad').value);utterance.voice=voice;utterance.lang=voice.lang;utterance.rate=.9;utterance.onend=stop;utterance.onerror=()=>{stop();$('voiceStatus').textContent='Playback could not finish. Please try again or copy the script.'};speechSynthesis.speak(utterance);$('play').textContent='Playing…';$('stop').disabled=false;$('voiceStatus').textContent='Playing using '+voice.name};$('stop').onclick=stop;
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('ad').value);toast('Ad script copied.')}catch{$('ad').focus();$('ad').select();toast('Select and copy the script from the text box.')}};
$('sarvamPlay').onclick=async()=>{
  if(!$('confirmed').checked){toast('Review the details and check the confirmation box before playback.');return}
  if(!$('ad').value.trim()){toast('Create an ad script first.');return}
  stop();$('sarvamPlay').disabled=true;$('sarvamPlay').textContent='Generating…';$('voiceStatus').textContent='Requesting Sarvam audio…';
  try{
    const response=await fetch('/api/voice-ad',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:$('ad').value,language:$('language').value,reviewed:true})});
    const body=await response.json().catch(()=>({}));
    if(!response.ok){$('sarvamAudio').hidden=true;$('voiceStatus').textContent=body.error?.message||'Sarvam audio is not available. Use device playback or copy the script.';return}
    if(typeof body.audio!=='string'||!body.audio){$('sarvamAudio').hidden=true;$('voiceStatus').textContent='Sarvam returned no audio. Use device playback or copy the script.';return}
    $('sarvamAudio').src='data:audio/'+(body.format||'wav')+';base64,'+body.audio;$('sarvamAudio').hidden=false;$('sarvamAudio').play?.();
    $('voiceStatus').textContent='Playing Sarvam audio ('+body.model+'). This is a real generated clip, not a device voice.';
  }catch{$('sarvamAudio').hidden=true;$('voiceStatus').textContent='Sarvam request failed. Use device playback or copy the script.'}
  finally{$('sarvamPlay').disabled=false;$('sarvamPlay').textContent=i18nLabel('generateAudio','▶ Generate Sarvam audio')}
};
$('reportListen').onclick=async()=>{
  const text=[$('title').value.trim(),$('description').value.trim()].filter(Boolean).join('. ');
  if(!text){toast('Add a title or description first.');return}
  $('reportAudio').pause?.();$('reportListen').disabled=true;$('reportListenStatus').textContent='Requesting audio…';
  try{
    const response=await fetch('/api/voice-ad',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,language:$('language').value,reviewed:true})});
    const body=await response.json().catch(()=>({}));
    if(!response.ok){$('reportAudio').hidden=true;$('reportListenStatus').textContent=body.error?.message||'Report audio is not available right now.';return}
    if(typeof body.audio!=='string'||!body.audio){$('reportAudio').hidden=true;$('reportListenStatus').textContent='No audio was returned.';return}
    $('reportAudio').src='data:audio/'+(body.format||'wav')+';base64,'+body.audio;$('reportAudio').hidden=false;$('reportAudio').play?.();
    $('reportListenStatus').textContent='Playing report audio ('+body.model+').';
  }catch{$('reportAudio').hidden=true;$('reportListenStatus').textContent='Report audio request failed.'}
  finally{$('reportListen').disabled=false}
};
function catalog(){return {schema:'dukaan-scan.catalog-draft.v3',status:'draft',ondc_submission_ready:false,requires:['ONDC seller onboarding','Category and attribute mapping','Hosted product image','Fulfilment, tax and availability information','Protocol validation'],product:{title:$('title').value.trim(),description:$('description').value.trim(),category:$('category').value,material:$('material').value.trim()||null,condition:$('condition').value||null,price:priceValid()?{currency:$('p_currency').value,value:Number($('price').value).toFixed(2),source:'merchant'}:null,image_status:photoURL?'local_photo_not_exported':'sample_without_photo'},pricing:pricingExport(),marketing:marketingResult,social_marketing:typeof socialExport==='function'?socialExport():null,product_intelligence:appliedAnalysis?.intelligence?{...appliedAnalysis.intelligence,product_identity:{...appliedAnalysis.intelligence.product_identity,merchant_edited_title:$('title').value},pricing_analysis:pricingExport(),marketing_content:typeof socialExport==='function'?socialExport():null,review_status:$('confirmed').checked?'approved':'pending'}:null,ad:{language:$('language').value,script:$('ad').value,price_included:$('includePrice').checked&&priceValid()&&$('priceApproved').checked,voice_provider:'device_preview'},provenance:{image_analysis:(appliedAnalysis||analysis)?'gemini':'not_performed',copy:draftSource,merchant_reviewed:$('confirmed').checked},analysis:appliedAnalysis?{...appliedAnalysis,merchantReview:{...appliedAnalysis.merchantReview,status:$('confirmed').checked?'approved':'pending',approvedFields:$('confirmed').checked?[...acceptedFields]:[]}}:null}}
$('export').onclick=()=>{if(!$('title').value.trim()){toast('Add a product title before exporting.');return}if($('price').value&&!priceValid()){toast('Enter a positive price with up to two decimal places, or leave it blank.');return}if(!$('confirmed').checked){toast('Review the details and check the confirmation box before exporting.');return}if(typeof socialExport==='function'&&socialExport()&&socialExport().review_status!=='approved'){toast('Review and approve the marketing draft before exporting.');return}let output;try{output=catalog()}catch{toast('Check pricing inputs before exporting.');return}const url=URL.createObjectURL(new Blob([JSON.stringify(output,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='dukaan-catalog-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Catalog draft downloaded. ONDC integration is still required.')};
function uuidv4(){return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return (c==='x'?r:(r&0x3|0x8)).toString(16)})}
// Structural shape verified against the official Beckn protocol schema (schema/{Context,Catalog,Provider,Item,Price,Descriptor,Category,Fulfillment}.yaml
// in github.com/beckn/protocol-specifications, the submodule ONDC-RET-Specifications itself uses). Field VALUES below that need an ONDC registry
// account (bap/bpp subscriber IDs, provider ID, domain/category approval) are left null or clearly labelled pending, never guessed.
function ondcCatalog(){
  const price=priceValid()?{currency:$('p_currency').value,value:Number($('price').value).toFixed(2)}:null;
  const categoryId=$('category').value;
  const item={id:'item-1',descriptor:{name:$('title').value.trim(),short_desc:$('title').value.trim().slice(0,80),long_desc:$('description').value.trim(),images:photoURL?[{url:photoURL}]:[]},price,category_ids:[categoryId],fulfillment_ids:['fulfillment-1']};
  const provider={id:'PENDING_ONDC_SELLER_ONBOARDING',descriptor:{name:$('title').value.trim()||'Merchant store'},categories:[{id:categoryId,descriptor:{name:categoryId}}],items:[item],fulfillments:[{id:'fulfillment-1',type:'Delivery'}]};
  const context={domain:'ONDC:RET12',domain_note:'ONDC:RET12 (Fashion/apparel) is a published ONDC domain code commonly used for textile listings; confirm it against your own ONDC-approved category before real submission — it is not verified for this specific seller account.',country:'IND',city:null,action:'on_search',core_version:'1.2.0',bap_id:null,bap_uri:null,bpp_id:null,bpp_uri:null,transaction_id:uuidv4(),message_id:uuidv4(),timestamp:new Date().toISOString()};
  return {schema:'beckn-ondc.catalog.on_search.structural-v1',schema_reference:'github.com/beckn/protocol-specifications schema/{Context,Catalog,Provider,Item,Price,Descriptor,Category,Fulfillment}.yaml, via ONDC-RET-Specifications release-2.0.2',status:'draft',ondc_submission_ready:false,requires:['ONDC registry subscriber onboarding (bap_id/bap_uri or bpp_id/bpp_uri)','Seller/provider ID issued at ONDC onboarding','Confirmed domain and category mapping for this seller account','Hosted, non-blob product image URL','Fulfilment, tax (GST/HSN) and return/cancellation terms','Protocol signing and validation by a registered network participant'],context,message:{catalog:{descriptor:{name:'Kriti merchant catalog'},providers:[provider]}}};
}
function validateOndcCatalog(c){
  const errors=[];const provider=c.message?.catalog?.providers?.[0],item=provider?.items?.[0];
  if(!c.context?.domain)errors.push(i18nText('ondcMissingDomain','context.domain is required'));
  if(!c.context?.transaction_id||!c.context?.message_id)errors.push(i18nText('ondcMissingContext','context.transaction_id and message_id are required'));
  if(!provider?.id)errors.push(i18nText('ondcMissingProviderId','provider.id is required'));
  if(!provider?.descriptor?.name)errors.push(i18nText('ondcMissingProviderName','provider.descriptor.name is required'));
  if(!item?.id)errors.push(i18nText('ondcMissingItemId','item.id is required'));
  if(!item?.descriptor?.name)errors.push(i18nText('ondcMissingItemName','Add a product title.'));
  if(!item?.price?.currency||!item?.price?.value)errors.push(i18nText('ondcMissingPrice','Add and approve a selling price.'));
  if(!item?.category_ids?.length)errors.push(i18nText('ondcMissingCategory','item.category_ids must include at least one category'));
  if(!item?.fulfillment_ids?.length)errors.push(i18nText('ondcMissingFulfillment','item.fulfillment_ids must reference a fulfillment'));
  return errors;
}
$('exportOndc').onclick=()=>{
  if(!$('title').value.trim()){toast('Add a product title before exporting.');return}
  if(!priceValid()||!$('priceApproved').checked){toast('Approve a valid seller price before exporting an ONDC catalog item.');return}
  if(!$('confirmed').checked){toast('Review the details and check the confirmation box before exporting.');return}
  let output;try{output=ondcCatalog()}catch{toast('Check listing inputs before exporting.');return}
  const errors=validateOndcCatalog(output);
  if(errors.length){toast('ONDC export blocked: '+errors[0]);return}
  const url=URL.createObjectURL(new Blob([JSON.stringify(output,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='dukaan-ondc-catalog.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast('ONDC-shaped catalog downloaded. Registry onboarding and submission are still required.');
};
window.addEventListener('beforeunload',stop);
if(document.modelContext?.registerTool){const life=new AbortController();try{Promise.resolve(document.modelContext.registerTool({name:'read_catalog_draft',description:'Read the current editable merchant catalog draft without exporting it.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute(input){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw new Error('Expected an empty object');if(!ready)throw new Error('Create a draft first');return catalog()}},{signal:life.signal})).catch(()=>{});}catch{}window.addEventListener('pagehide',()=>life.abort(),{once:true})}

function cancelAnalysis(){requestSequence++;analysisController?.abort();analysisController=null;$('generate').disabled=false;$('generate').textContent=i18nText('analyzeButton','Analyze my product')}
function newProduct(){if(typeof beginCloudProduct==='function')beginCloudProduct();
  if(typeof invalidateSocial==='function')invalidateSocial();
  cancelAnalysis();productVersion++;resetPricing();currentFile=null;analysis=null;appliedAnalysis=null;acceptedFields=[];draftSource='sample';
  for(const id of ['title','description','material','condition','price','notes'])$(id).value='';
  $('includePrice').checked=false;$('analysisPanel').hidden=true;resetDraft();
}
$('notes').addEventListener('input',()=>{cancelAnalysis();$('confirmed').checked=false;if(analysis){analysis=null;$('analysisPanel').hidden=true;$('aiStatus').textContent=i18nText('notesChangedStatus','Notes changed. Analyze again for fresh evidence.')}});
async function analyzePhoto(){
  if(!currentFile){toast('Upload a product photo for Gemini, or use a sample draft.');return}
  cancelAnalysis();const request=++requestSequence,version=productVersion;
  analysisController=new AbortController();const controller=analysisController;
  const timeout=setTimeout(()=>controller.abort(),requestTimeoutMs);
  $('generate').disabled=true;$('generate').textContent=i18nText('analyzingState','Analyzing…');$('aiStatus').textContent=i18nText('sendingForAnalysis','Sending photo and notes for AI analysis…');
  $('analyzeErrorBox').hidden=true;if(photoURL){$('analyzingPreview').src=photoURL;$('analyzingPreview').hidden=false}else $('analyzingPreview').hidden=true;
  window.DukaanScreens?.show('screen-analyzing');
  const form=new FormData();form.append('image',currentFile);form.append('notes',$('notes').value);form.append('category',$('category').value);
  try{
    const response=await fetch('/api/analyze-product',{method:'POST',body:form,signal:controller.signal});
    const contentType=response.headers.get('content-type')||'';
    if(!contentType.includes('application/json'))throw new Error('AI backend is unavailable here. Use the category sample draft.');
    const result=await response.json();
    if(!response.ok)throw new Error(result.error?.message||'AI unavailable. Use a sample draft.');
    if(request!==requestSequence||version!==productVersion)return;
    if(result.source!=='gemini'||!result.title||!Array.isArray(result.evidence)||!Array.isArray(result.uncertainty)||!Array.isArray(result.missingInformation)||!Array.isArray(result.visibleAttributes))throw new Error('AI returned an invalid result. Use a sample draft.');
    analysis=result;renderAnalysis();if(!ready){$('applyAnalysis').onclick();}if(typeof saveDraft==='function')void saveDraft();
    $('aiStatus').textContent=i18nText('analysisReceivedStatus','Analysis received. Review the evidence and apply supported suggestions.');
    $('confirmed').checked=false;
    window.DukaanScreens?.show('screen-report');
  }catch(error){
    if(request!==requestSequence||version!==productVersion)return;
    const message=error.name==='AbortError'?'Analysis timed out. Retry or use a sample draft.':error.message;
    $('aiStatus').textContent=message;$('analyzeErrorText').textContent=message;$('analyzeErrorBox').hidden=false;
  }finally{
    clearTimeout(timeout);
    if(request===requestSequence){analysisController=null;$('generate').disabled=false;$('generate').textContent=i18nText('analyzeButton','Analyze my product')}
  }
}
function textElement(tag,text,className){const element=document.createElement(tag);element.textContent=text;if(className)element.className=className;return element}
function renderAnalysis(){
  const suggestions=$('suggestions');suggestions.replaceChildren();
  for(const field of ['title','description','category']){
    const claim=analysis[field];const label=document.createElement('label');label.className='suggestion';
    const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.dataset.field=field;checkbox.disabled=!claim.value;checkbox.checked=Boolean(claim.value);
    label.append(checkbox,textElement('span',field+': '+(claim.value?claim.value+' ['+claim.evidenceIds.join(', ')+']':'Not identifiable — seller input needed')));suggestions.append(label);
  }
  const details=$('analysisDetails');details.replaceChildren();
  const groups=[['Visible attributes',analysis.visibleAttributes.map(a=>a.name+': '+a.value+' ['+a.evidenceIds.join(', ')+']')],
    ['Evidence',analysis.evidence.map(e=>e.id+' · '+(e.kind==='image'?'Photo':'Seller notes')+': '+e.observation)],
    ['Uncertainty',analysis.uncertainty.map(u=>u.field+' ('+u.level+'): '+u.reason)],
    ['Ask the seller',analysis.missingInformation.map(m=>m.field+': '+m.question)]];
  for(const [heading,items] of groups){details.append(textElement('h4',heading));const list=document.createElement('ul');for(const item of items)list.append(textElement('li',item));if(!items.length)list.append(textElement('li','None reported by the model; merchant review is still required.'));details.append(list)}
  $('analysisPanel').hidden=false;if(typeof renderIntelligence==='function')renderIntelligence();
}
$('applyAnalysis').onclick=()=>{
  if(!analysis)return;
  const fields=[...$('suggestions').querySelectorAll('input:checked')].map(input=>input.dataset.field);
  if(!fields.length){toast('Select a suggestion first.');return}
  if(ready&&!window.confirm('Apply the selected suggestions over these editor fields? Your price, material and condition will be kept.'))return;
  if(typeof invalidateSocial==='function')invalidateSocial();invalidatePricing();for(const field of fields)if(analysis[field]?.value)$(field).value=analysis[field].value;
  acceptedFields=[...new Set([...(appliedAnalysis===analysis?acceptedFields:[]),...fields])];appliedAnalysis=analysis;draftSource='gemini_suggestions_merchant_editable';
  $('confirmed').checked=false;$('listingNotice').textContent='AI-assisted draft · Check evidence and confirm every detail.';
  showEditor();makeAd();toast('Selected suggestions applied. Your selling price is preserved.');
};
fetch('/api/status').then(r=>r.ok?r.json():Promise.reject()).then(status=>{
  requestTimeoutMs=Number(status.requestTimeoutMs)||45000;if(analysisController||analysis)return;
  $('aiStatus').textContent=status.configured?i18nText('aiConfiguredStatus','AI configured; the first analysis will verify access.'):i18nText('aiNotConfiguredStatus','AI is not configured. The sample demo is available.');
}).catch(()=>{if(!analysisController&&!analysis)$('aiStatus').textContent=i18nText('staticDemoMode','Static demo mode. Run the Node backend for AI, or use sample drafts.')});
