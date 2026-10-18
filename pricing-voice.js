/* Dictation fills only the selected feature; prices and approvals are never set here. */
(() => {
 const get=id=>document.getElementById(id),start=get('voice-pricing-start'),stop=get('voice-pricing-stop'),target=get('voice-pricing-target'),status=get('voice-pricing-status');
 const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 const languages={en:'en-IN',hi:'hi-IN',kn:'kn-IN',ta:'ta-IN',te:'te-IN',ml:'ml-IN',mr:'mr-IN',bn:'bn-IN'};
 let active=null;
 function cancel(){if(active){const old=active;active=null;old.abort();}start.disabled=!Recognition;stop.disabled=true;target.disabled=false;}
 if(!Recognition){start.disabled=true;status.textContent='Speech input is unavailable in this browser. Type your features below.';return;}
 start.onclick=()=>{
  cancel();const field=get(target.value),base=field.value,parts=new Map(),recognition=new Recognition();active=recognition;
  let lang='en';try{lang=localStorage.getItem('dukaan_ui_lang')||'en'}catch{}
  recognition.lang=languages[lang]||'en-IN';recognition.interimResults=false;recognition.continuous=false;
  start.disabled=true;stop.disabled=false;target.disabled=true;status.textContent='Listening… Speak the selected feature.';
  recognition.onresult=event=>{if(active!==recognition)return;for(let i=event.resultIndex;i<event.results.length;i++)if(event.results[i].isFinal)parts.set(i,event.results[i][0].transcript);const text=[base,...parts.values()].filter(Boolean).join(' ').trim();field.value=text.slice(0,field.maxLength>0?field.maxLength:200);field.dispatchEvent(new Event('input',{bubbles:true}));status.textContent='Text added. Review it before calculating pricing advice.';};
  recognition.onerror=event=>{if(active!==recognition)return;status.textContent=event.error==='not-allowed'?'Microphone access denied. Allow it in your browser or type below.':'Speech input could not finish. Try again or type below.';cancel();};
  recognition.onend=()=>{if(active!==recognition)return;active=null;start.disabled=false;stop.disabled=true;target.disabled=false;if(!parts.size)status.textContent='No speech captured. Try again or type below.';};
  try{recognition.start()}catch{cancel();status.textContent='Microphone could not start. Try again or type below.';}
 };
 stop.onclick=()=>{active?.stop();stop.disabled=true;status.textContent='Finishing dictation…';};
 window.addEventListener('pagehide',cancel);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel()});
 document.addEventListener('click',event=>{if(event.target.closest?.('.back-button, #account_logout, #reportContinue'))cancel()});
})();
