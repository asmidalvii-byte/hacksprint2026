/* Local single-draft storage. No credentials or remote uploads. */
(function(scope){
 function createStore(indexedDB){
  async function open(){return new Promise((resolve,reject)=>{if(!indexedDB)return reject(Error('Storage unavailable'));const request=indexedDB.open('dukaanscan-drafts',1);request.onupgradeneeded=()=>request.result.createObjectStore('drafts');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(Error('Storage unavailable'));request.onblocked=()=>reject(Error('Storage blocked'));});}
  async function transaction(mode,value){const db=await open();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('drafts',mode),store=tx.objectStore('drafts');let result;const req=mode==='readonly'?store.get('current'):store.put(value,'current');req.onsuccess=()=>{result=req.result};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(Error('Draft could not be saved'));tx.onabort=()=>reject(Error('Draft transaction aborted'));});}finally{db.close()}}
  return {load:()=>transaction('readonly'),save:value=>transaction('readwrite',value)};
 }
 scope.DukaanDraftStorage={createStore};
})(globalThis);
