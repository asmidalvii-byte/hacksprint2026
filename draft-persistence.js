const draftStore=DukaanDraftStorage.createStore(globalThis.indexedDB);
function localDraftStore(account){return account?.demoAccess?DukaanDraftStorage.createStore(globalThis.indexedDB,'test-account:'+account.user.id):draftStore}
let draftSaveTimer,draftInteracted=false,draftRestoring=true,draftSaveChain=Promise.resolve(),cloudProductId=null,cloudImagePath=null,cloudImageFile=null;
function draftControls(){return [...document.querySelectorAll('input[id],textarea[id],select[id]')].filter(el=>el.type!=='file'&&!/^(account_|verification_|inventory-|help-|voice-)/.test(el.id))}
function captureDraft(){return {version:2,savedAt:new Date().toISOString(),fields:Object.fromEntries(draftControls().map(el=>[el.id,{value:el.value,checked:el.checked}])),file:currentFile,ready,sample,analysis,appliedAnalysis,acceptedFields,draftSource,pricingResult,marketingResult,socialDraft,socialDirty,socialContextStale};}
function beginCloudProduct(){cloudProductId=null;cloudImagePath=null;cloudImageFile=null}
function saveDraft(){
 if(draftRestoring)return Promise.resolve(false);if(!ready&&!currentFile&&!$('title').value.trim())return Promise.resolve(true);const snapshot=captureDraft(),account=window.KritiAccount;
 if(account?.configured&&!account.user)return Promise.resolve(false);
 const cloud=account?.configured&&!account.demoAccess;
 if(cloud&&!cloudProductId)cloudProductId=crypto.randomUUID();const id=cloudProductId;
 draftSaveChain=draftSaveChain.catch(()=>false).then(async()=>{
  if(cloud){
   let imagePath=cloudImagePath;
   if(snapshot.file&&snapshot.file!==cloudImageFile){imagePath=account.user.id+'/'+crypto.randomUUID();const {error}=await account.client.storage.from('product-images').upload(imagePath,snapshot.file,{contentType:snapshot.file.type,upsert:false});if(error)throw error;if(id===cloudProductId){cloudImagePath=imagePath;cloudImageFile=snapshot.file}}
   const {file,...serialized}=snapshot;const response=await fetch('/api/products/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({snapshot:serialized,image_path:imagePath})});if(!response.ok)throw Error();
  }else await localDraftStore(account).save(snapshot);
  $('draftSaveStatus').textContent=(cloud?'Saved to your account at ':'Saved on this device at ')+new Date(snapshot.savedAt).toLocaleTimeString();return true;
 }).catch(()=>{$('draftSaveStatus').textContent='Saving failed. Your edits remain in this tab. Retry before closing.';return false});return draftSaveChain;
}
function scheduleDraftSave(event){if(event?.target?.id==='approvePrice')return;if(event?.target?.id&&/^(account_|verification_|inventory-|help-|voice-)/.test(event.target.id))return;draftInteracted=true;clearTimeout(draftSaveTimer);draftSaveTimer=setTimeout(()=>void saveDraft(),500)}
$('saveDraft').onclick=()=>void saveDraft();document.addEventListener('input',scheduleDraftSave);document.addEventListener('change',scheduleDraftSave);document.addEventListener('click',scheduleDraftSave);
function applySavedDraft(saved){
 for(const el of draftControls()){const value=saved.fields?.[el.id];if(value){el.value=value.value;el.checked=Boolean(value.checked)}}
 currentFile=saved.file||null;sample=Boolean(saved.sample);analysis=saved.analysis||null;appliedAnalysis=saved.appliedAnalysis||null;acceptedFields=saved.acceptedFields||[];draftSource=saved.draftSource||'sample';pricingResult=saved.pricingResult||null;marketingResult=saved.marketingResult||null;socialDraft=saved.socialDraft||null;socialDirty=Boolean(saved.socialDirty);socialContextStale=Boolean(saved.socialContextStale);
 if(photoURL)URL.revokeObjectURL(photoURL);photoURL=null;$('preview').hidden=true;
 if(currentFile){photoURL=URL.createObjectURL(currentFile);$('preview').src=photoURL;$('preview').hidden=false;$('uploadIcon').hidden=true;$('uploadLabel').textContent=currentFile.name||'Restored product photo';}
 if(saved.ready)showEditor();if(analysis)renderAnalysis();if(pricingResult)renderPricing();if(marketingResult)$('marketingResult').textContent=Object.values(marketingResult).filter(v=>typeof v==='string').join('\n\n');
 $('currencyLabel').textContent=$('p_currency').value;lastCurrency=$('p_currency').value;
 // Legacy snapshots did not bind approvals to a durable workflow version.
 if(saved.version!==2){$('confirmed').checked=false;$('priceApproved').checked=false;$('socialApproved').checked=false;}
 if(!priceValid())$('priceApproved').checked=false;
 $('instagramFinalApproval').checked=false;
 if(socialDraft){$('socialPanel').hidden=false;$('socialSource').textContent='Saved marketing draft restored.';updateInstagramPreview();}else $('socialPanel').hidden=true;
 if(typeof updateWorkflow==='function')updateWorkflow();
}
async function loadCloudProduct(id){
 try{const r=await fetch('/api/products/'+id);if(!r.ok)throw Error();const row=await r.json();let file=null;if(row.image_path){const {data,error}=await window.KritiAccount.client.storage.from('product-images').download(row.image_path);if(error)throw error;file=data}
 cancelAnalysis();invalidateSocial();pricingRequest++;pricingController?.abort();applySavedDraft({...row.snapshot,file});cloudProductId=row.id;cloudImagePath=row.image_path;cloudImageFile=file;$('draftSaveStatus').textContent='Saved product and approvals restored.';
 }catch{$('draftSaveStatus').textContent='Could not restore the saved product. Current edits are unchanged.'}
}
async function restoreDraft(){try{
 await window.KritiAccount?.ready;
 if(window.KritiAccount?.configured&&!window.KritiAccount.demoAccess){if(window.KritiAccount.user&&window.KritiAccount.accessAllowed){const r=await fetch('/api/products');if(!r.ok)throw Error();const rows=await r.json();if(rows.length&&!draftInteracted)await loadCloudProduct(rows[0].id);void window.KritiAccount.listProducts()}return}
 const saved=await localDraftStore(window.KritiAccount).load();if(!saved||![1,2].includes(saved.version)||draftInteracted)return;applySavedDraft(saved);$('draftSaveStatus').textContent='Device draft restored. Saved approvals retained for unchanged details.';
 }catch{$('draftSaveStatus').textContent='Draft storage unavailable. Keep this tab open and export JSON.'}finally{draftRestoring=false}}
void restoreDraft();void refreshIntegrationStatus();
