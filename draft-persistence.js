const draftStore=DukaanDraftStorage.createStore(globalThis.indexedDB);
let draftSaveTimer,draftInteracted=false,draftRestoring=true,draftSaveChain=Promise.resolve();
function draftControls(){return [...document.querySelectorAll('input[id],textarea[id],select[id]')].filter(el=>el.type!=='file')}
function captureDraft(){return {version:1,savedAt:new Date().toISOString(),fields:Object.fromEntries(draftControls().map(el=>[el.id,{value:el.value,checked:el.checked}])),file:currentFile,ready,sample,analysis,appliedAnalysis,acceptedFields,draftSource,pricingResult,marketingResult,socialDraft,socialDirty,socialContextStale};}
function saveDraft(){if(draftRestoring)return Promise.resolve();const snapshot=captureDraft();draftSaveChain=draftSaveChain.catch(()=>{}).then(()=>draftStore.save(snapshot)).then(()=>{$('draftSaveStatus').textContent='Saved on this device at '+new Date(snapshot.savedAt).toLocaleTimeString();}).catch(()=>{$('draftSaveStatus').textContent='Local saving failed or storage is full. Keep this tab open and export your draft.';});return draftSaveChain;}
function scheduleDraftSave(){draftInteracted=true;clearTimeout(draftSaveTimer);draftSaveTimer=setTimeout(()=>void saveDraft(),250)}
$('saveDraft').onclick=()=>void saveDraft();
document.addEventListener('input',scheduleDraftSave);document.addEventListener('change',scheduleDraftSave);document.addEventListener('click',scheduleDraftSave);
async function restoreDraft(){try{const saved=await draftStore.load();if(!saved||saved.version!==1||draftInteracted)return;
 for(const el of draftControls()){const value=saved.fields?.[el.id];if(value){el.value=value.value;el.checked=Boolean(value.checked)}}
 currentFile=saved.file||null;sample=Boolean(saved.sample);analysis=saved.analysis||null;appliedAnalysis=saved.appliedAnalysis||null;acceptedFields=saved.acceptedFields||[];draftSource=saved.draftSource||'sample';pricingResult=saved.pricingResult||null;marketingResult=saved.marketingResult||null;socialDraft=saved.socialDraft||null;socialDirty=Boolean(saved.socialDirty);socialContextStale=Boolean(saved.socialContextStale);
 if(currentFile){photoURL=URL.createObjectURL(currentFile);$('preview').src=photoURL;$('preview').hidden=false;$('uploadIcon').hidden=true;$('uploadLabel').textContent=currentFile.name||'Restored product photo';}
 if(saved.ready)showEditor();if(analysis)renderAnalysis();if(pricingResult)renderPricing();if(marketingResult)$('marketingResult').textContent=JSON.stringify(marketingResult,null,2);
 $('currencyLabel').textContent=$('p_currency').value;lastCurrency=$('p_currency').value;
 $('confirmed').checked=false;$('priceApproved').checked=false;$('socialApproved').checked=false;$('instagramFinalApproval').checked=false;$('socialIncludePrice').checked=false;
 if(socialDraft){$('socialPanel').hidden=false;$('socialSource').textContent='Restored local draft. Review text, photo and price before sharing.';updateInstagramPreview();}
 $('draftSaveStatus').textContent='Draft and photo restored from this browser. Prices and edits preserved; approvals need review.';
 }catch{$('draftSaveStatus').textContent='Draft storage unavailable. You can keep working and export JSON.';}finally{draftRestoring=false}}
void restoreDraft();
void refreshIntegrationStatus();
