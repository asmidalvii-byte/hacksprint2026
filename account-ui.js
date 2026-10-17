function registrationError(error,action='Registration'){
 const messages={
 invalid_credentials:'The email or password is incorrect. If registration never completed, create an account first.',
 email_not_confirmed:'Confirm your email before signing in. Check your inbox and spam folder for the confirmation link.',
 user_banned:'This account is restricted. Contact the project owner.',
 session_expired:'Your session expired. Sign in again.',
 email_address_not_authorized:'Supabase cannot send account email to this address with its default email service. The project owner must configure custom SMTP, or use an authorized project-team email for testing.',
 over_email_send_rate_limit:'The account-email limit has been reached. Wait before retrying; the project owner can configure custom SMTP for more capacity.',
 over_request_rate_limit:'Too many registration attempts. Wait before trying again.',
 weak_password:'The password does not meet this project’s security requirements. Use a longer password with uppercase, lowercase, numbers and symbols.',
 email_address_invalid:'Enter a valid email address.',
 validation_failed:'Check the email address and password requirements, then retry.',
 signup_disabled:'Registration is disabled in this Supabase project. The owner must enable new-user signup.',
 email_provider_disabled:'Email registration is disabled in this Supabase project.',
 captcha_failed:'The project requires CAPTCHA verification. CAPTCHA must be integrated before registration can continue.',
 user_already_exists:'An account may already exist. Try signing in or resetting your password.',
 unexpected_failure:'Supabase could not complete registration. Check the project’s Auth logs and email delivery configuration.'
 };
 if(messages[error?.code])return messages[error.code];
 if(error?.status===429)return 'Too many requests or confirmation emails. Wait before retrying.';
 if(error?.name==='AuthRetryableFetchError'||error instanceof TypeError)return 'Could not reach the account service. Check your connection and try again.';
 const code=typeof error?.code==='string'&&/^[a-z_]{1,64}$/.test(error.code)?error.code:'unknown';
 return action+' could not complete (code: '+code+'). Share this code, not your password, so setup can be checked.';
}
/* Supabase public client. Seller API requests are independently authenticated server-side. */
window.KritiAccount={configured:false,user:null,client:null};
const accountNativeFetch=window.fetch.bind(window);
window.KritiAccount.ready=(async()=>{
 const message=document.getElementById('account_status');
 try{
  const response=await accountNativeFetch('/api/account-config');if(!response.ok)throw Error();const settings=await response.json();
  if(!settings.configured){if(settings.setupRequired)throw Error();message.textContent='Device demo · sign-in and cloud saving require setup.';document.getElementById('account_form').hidden=true;document.getElementById('workspace').hidden=false;return}
  const account=window.KritiAccount;account.configured=true;
  account.client=supabase.createClient(settings.url,settings.key);
  window.fetch=async(input,init={})=>{if(typeof input==='string'&&input.startsWith('/api/')){const {data:{session}}=await account.client.auth.getSession();const headers=new Headers(init.headers);if(session)headers.set('Authorization','Bearer '+session.access_token);return accountNativeFetch(input,{...init,headers})}return accountNativeFetch(input,init)};
  const apply=session=>{account.user=session?.user||null;document.getElementById('workspace').hidden=!account.user;document.getElementById('account_form').hidden=Boolean(account.user);document.getElementById('account_logout').hidden=!account.user;document.getElementById('account_products').hidden=!account.user;message.textContent=account.user?'Signed in as '+account.user.email:'Sign in to save your products securely.'};
  const {data:{session},error}=await account.client.auth.getSession();if(error)throw error;apply(session);
  account.client.auth.onAuthStateChange((event,session)=>{if(event==='PASSWORD_RECOVERY'){document.getElementById('account_new_password').hidden=false;document.getElementById('workspace').hidden=true;return}if(event==='SIGNED_OUT'){location.reload();return}if(session?.user.id!==account.user?.id&&event==='SIGNED_IN'){location.reload();return}apply(session)});
  let signingIn=false,resetting=false;
  document.getElementById('account_form').onsubmit=async e=>{
   e.preventDefault();if(signingIn)return;
   const email=document.getElementById('account_email'),password=document.getElementById('account_password'),button=document.getElementById('account_login');
   email.value=email.value.trim();if(!email.reportValidity()||!password.reportValidity())return;
   signingIn=true;button.disabled=true;message.textContent='Signing in…';
   try{const {error}=await account.client.auth.signInWithPassword({email:email.value,password:password.value});message.textContent=error?registrationError(error,'Sign-in'):'Signed in.'}
   catch(error){message.textContent=registrationError(error,'Sign-in')}finally{signingIn=false;button.disabled=false}
  };
  let registering=false;
  document.getElementById('account_register').onclick=async()=>{
   if(registering)return;
   const email=document.getElementById('account_email'),password=document.getElementById('account_password'),button=document.getElementById('account_register');
   email.value=email.value.trim();if(!email.reportValidity()||!password.reportValidity())return;
   registering=true;button.disabled=true;message.textContent='Creating your account…';
   try{const {data,error}=await account.client.auth.signUp({email:email.value,password:password.value,options:{emailRedirectTo:location.origin}});message.textContent=error?registrationError(error):data?.session?'Signed in.': 'Registration request accepted. Check your email to confirm; if you already registered, sign in or reset your password.'}
   catch(error){message.textContent=registrationError(error)}finally{registering=false;button.disabled=false}
  };
  document.getElementById('account_reset').onclick=async()=>{
   if(resetting)return;
   const email=document.getElementById('account_email'),button=document.getElementById('account_reset');
   email.value=email.value.trim();if(!email.reportValidity())return;
   resetting=true;button.disabled=true;message.textContent='Requesting password reset…';
   try{const {error}=await account.client.auth.resetPasswordForEmail(email.value,{redirectTo:location.origin});message.textContent=error?registrationError(error,'Password reset'):'Reset request accepted. If the account is eligible, check your inbox and spam folder for the reset email.'}
   catch(error){message.textContent=registrationError(error,'Password reset')}finally{resetting=false;button.disabled=false}
  };
  document.getElementById('account_new_password').onsubmit=async e=>{e.preventDefault();const {error}=await account.client.auth.updateUser({password:document.getElementById('account_replacement').value});message.textContent=error?'Password update failed. Request a new reset email.':'Password updated.';if(!error)location.reload()};
  document.getElementById('account_logout').onclick=async()=>{await saveDraft();const {error}=await account.client.auth.signOut();if(error)message.textContent='Sign-out failed. Try again.'};
  document.getElementById('account_refresh').onclick=account.listProducts;
 }catch{message.textContent='Account service unavailable or setup incomplete. Reload after fixing configuration.';document.getElementById('workspace').hidden=true}
})();
window.KritiAccount.listProducts=async()=>{const list=document.getElementById('account_product_list');try{const r=await fetch('/api/products');if(!r.ok)throw Error();const products=await r.json();list.replaceChildren();for(const p of products){const b=document.createElement('button');b.type='button';b.textContent=p.title||'Untitled product';b.onclick=async()=>{await saveDraft();await loadCloudProduct(p.id);window.DukaanScreens?.show('screen-report')};list.append(b)}}catch{document.getElementById('account_status').textContent='Could not load saved products. Your open draft is unchanged.'}};
document.getElementById('verification_submit').onclick=async()=>{document.getElementById('verification_status').textContent='Verification setup required. No authorized provider is connected. Details have not been submitted.'};
document.getElementById('verification_refresh').onclick=async()=>{
 if(!window.KritiAccount.user)return;try{const r=await fetch('/api/verification');if(!r.ok)throw Error();const data=await r.json();for(const kind of ['identity','business','gst']){const record=data.records.find(x=>x.kind===kind);document.getElementById('verification_'+kind).textContent=record?.status==='verified'&&record.verified_at&&(!record.expires_at||Date.parse(record.expires_at)>Date.now())?'Verified':(record?.status==='verified'?'Requires re-verification':record?.status||'Not started').replaceAll('_',' ')}document.getElementById('verification_status').textContent=data.message}catch{document.getElementById('verification_status').textContent='Unable to load verification status. No verification claimed.'}
};
