(function(scope){
 const languages={en:'en-IN',hi:'hi-IN',kn:'kn-IN',ta:'ta-IN',te:'te-IN',ml:'ml-IN',mr:'mr-IN',bn:'bn-IN'};
 function controller({Recognition,language,onState,onText}){
  let active=null,serial=0;
  function cancel(){serial++;const r=active;active=null;if(r)try{r.abort()}catch{}onState('Ready','Voice input cancelled. Existing text is unchanged.');}
  function start(){if(active)return;if(!Recognition){onState('Error','Voice input is unavailable in this browser. You can still type your description.');return}
   const code=languages[language()];if(!code){onState('Error','Select a supported language and retry, or type instead.');return}
   const id=++serial,r=new Recognition(),results=new Map();let failed=false;active=r;r.lang=code;r.continuous=true;r.interimResults=true;
   r.onstart=()=>{if(id===serial)onState('Listening','Listening… Speak naturally, then select Stop.');};
   r.onresult=e=>{if(id!==serial)return;let interim='';for(let i=e.resultIndex;i<e.results.length;i++){const row=e.results[i];if(row.isFinal)results.set(i,row[0].transcript);else interim+=row[0].transcript+' ';}onState('Listening',[...results.values()].join(' ')+' '+interim);};
   r.onerror=e=>{if(id!==serial)return;failed=true;const messages={'not-allowed':'Microphone permission denied. Allow access in browser settings or type instead.','audio-capture':'No microphone is available. Check your device or type instead.','network':'Speech recognition could not connect. Retry or type instead.','language-not-supported':'This speech service does not support the selected language. Change language or type instead.','no-speech':'No speech was detected. Retry or type instead.'};onState('Error',messages[e.error]||'Voice input failed. Your existing text is unchanged.');};
   r.onend=()=>{if(id!==serial)return;active=null;if(failed)return;const text=[...results.values()].join(' ').trim();if(!text){onState('Error','No words were recognized. Please try again or type.');return}onText(text);};
   try{onState('Listening','Requesting microphone access…');r.start()}catch{active=null;onState('Error','Could not start voice input. Retry or type instead.');}
  }
  function stop(){if(active){onState('Processing','Processing your speech…');try{active.stop()}catch{cancel()}}}
  return {start,stop,cancel,isActive:()=>Boolean(active)};
 }
 scope.KritiVoice={controller,languages};
 if(typeof document==='undefined')return;
 let current=null;
 for(const id of ['notes','description']){
  const field=document.getElementById(id);if(!field)continue;
  const box=document.createElement('div');box.className='voice-controls';box.innerHTML='<button type="button" class="secondary voice-start" aria-label="Start voice input"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0zM5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" fill="none" stroke="currentColor" stroke-width="1.6"/></svg> Speak your description</button><button type="button" class="secondary voice-stop" hidden>Stop</button><button type="button" class="text-button voice-cancel" hidden>Cancel</button><p class="voice-status" role="status">Ready · Voice availability depends on your browser and language.</p><p class="muted small">Your browser may send audio to its speech service. Kriti does not save audio. You can always type instead.</p>';
  field.after(box);const status=box.querySelector('.voice-status'),start=box.querySelector('.voice-start'),stop=box.querySelector('.voice-stop'),cancel=box.querySelector('.voice-cancel');
  const c=controller({Recognition:scope.SpeechRecognition||scope.webkitSpeechRecognition,language:()=>scope.DukaanScreens?.currentLang()||'en',onState:(state,message)=>{status.textContent=state+' · '+message;box.dataset.state=state;const recording=['Listening','Processing'].includes(state);start.disabled=recording;stop.hidden=!recording;cancel.hidden=!recording;},onText:text=>{const merged=[field.value.trim(),text].filter(Boolean).join(' ');if(field.maxLength>0&&merged.length>field.maxLength){status.textContent='Error · Description is too long. Shorten it, then retry. Recognized: '+text;start.disabled=false;stop.hidden=cancel.hidden=true;return}field.value=merged;field.dispatchEvent(new Event('input',{bubbles:true}));status.textContent='Completed · Review and edit your description.';start.disabled=false;stop.hidden=cancel.hidden=true;box.dataset.state='Completed';}});
  start.onclick=()=>{if(current&&current!==c)current.cancel();current=c;c.start()};stop.onclick=c.stop;cancel.onclick=c.cancel;
 }
 const abort=()=>{if(current?.isActive())current.cancel()};
 scope.addEventListener('pagehide',abort);document.addEventListener('visibilitychange',()=>{if(document.hidden)abort()});document.addEventListener('kriti:navigate',abort);document.addEventListener('kriti:language',abort);
 document.getElementById('account_logout')?.addEventListener('click',abort);
 // Explicitly reuse edited description as seller evidence; Gemini still requires a photo and review.
 const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent='Use description in AI analysis';button.onclick=()=>{const text=document.getElementById('description').value.trim(),notes=document.getElementById('notes');if(!text){scope.toast?.('Add a description first.');return}if(!scope.confirm('Add this description to your seller notes for the next photo analysis?'))return;const merged=[notes.value.trim(),text].filter(Boolean).join('\n');if(merged.length>notes.maxLength){scope.toast?.('Seller notes are too long. Shorten them first.');return}notes.value=merged;notes.dispatchEvent(new Event('input',{bubbles:true}));scope.DukaanScreens.show('screen-home');notes.focus()};document.getElementById('description')?.parentElement?.insertBefore(button,document.getElementById('description').nextSibling);
})(globalThis);
