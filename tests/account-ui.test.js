import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../account-ui.js',import.meta.url),'utf8');
async function setup(signUp){const elements=new Map();const el=id=>{if(!elements.has(id))elements.set(id,{value:id==='account_email'?' user@example.test ':'long-password',reportValidity:()=>true});return elements.get(id)};const auth={getSession:async()=>({data:{session:null}}),onAuthStateChange(){},signUp};const context=vm.createContext({window:{fetch:async()=>({ok:true,json:async()=>({configured:true,url:'https://example.test',key:'public'})})},document:{getElementById:el},supabase:{createClient:()=>({auth})},location:{origin:'http://127.0.0.1:3000'},Headers});vm.runInContext(source,context);await context.window.KritiAccount.ready;return {el,context,auth}}
test('registration validates fields before sending and prevents repeated submissions (mock Auth)',async()=>{let calls=0,resolve;const {el}=await setup(async input=>{calls++;assert.equal(input.email,'user@example.test');assert.equal(input.options.emailRedirectTo,'http://127.0.0.1:3000');return new Promise(r=>resolve=r)});el('account_email').reportValidity=()=>false;await el('account_register').onclick();assert.equal(calls,0);el('account_email').reportValidity=()=>true;const task=el('account_register').onclick();await el('account_register').onclick();assert.equal(calls,1);resolve({error:{code:'email_address_not_authorized',message:'secret raw details'}});await task;assert.match(el('account_status').textContent,/custom SMTP/);assert.doesNotMatch(el('account_status').textContent,/secret/);assert.equal(el('account_register').disabled,false)});
test('registration distinguishes rate limits, password policy and network failure without raw messages',async()=>{for(const [error,expected] of [[{code:'over_email_send_rate_limit'},/limit/],[{code:'weak_password'},/security requirements/],[{name:'AuthRetryableFetchError'},/connection/],[{code:'unknown_safe',message:'private'},/unknown_safe/]]){const {el}=await setup(async()=>({error}));await el('account_register').onclick();assert.match(el('account_status').textContent,expected);assert.doesNotMatch(el('account_status').textContent,/private/)}});

test('sign-in reports unconfirmed email and invalid credentials without exposing raw errors',async()=>{
 for(const [code,pattern] of [['email_not_confirmed',/Confirm your email/],['invalid_credentials',/email or password is incorrect/]]){
 const {el,auth}=await setup();auth.signInWithPassword=async input=>{assert.equal(input.email,'user@example.test');return {error:{code,message:'private details'}}};
 await el('account_form').onsubmit({preventDefault(){}});assert.match(el('account_status').textContent,pattern);assert.doesNotMatch(el('account_status').textContent,/private details/);assert.equal(el('account_login').disabled,false);
 }
});
test('reset validates email only, blocks duplicate requests and explains SMTP restriction',async()=>{
 const {el,auth}=await setup();let calls=0,resolve;auth.resetPasswordForEmail=async(email,options)=>{calls++;assert.equal(email,'user@example.test');assert.equal(options.redirectTo,'http://127.0.0.1:3000');return new Promise(r=>resolve=r)};
 el('account_email').reportValidity=()=>false;await el('account_reset').onclick();assert.equal(calls,0);
 el('account_email').reportValidity=()=>true;el('account_password').reportValidity=()=>false;
 const pending=el('account_reset').onclick();await el('account_reset').onclick();assert.equal(calls,1);resolve({error:{code:'email_address_not_authorized'}});await pending;assert.match(el('account_status').textContent,/custom SMTP/);assert.equal(el('account_reset').disabled,false);
});
test('reset network exception is actionable and success does not claim email delivery',async()=>{
 const {el,auth}=await setup();auth.resetPasswordForEmail=async()=>{throw {name:'AuthRetryableFetchError',message:'secret'}};await el('account_reset').onclick();assert.match(el('account_status').textContent,/connection/);assert.equal(el('account_reset').disabled,false);
 auth.resetPasswordForEmail=async()=>({error:null});await el('account_reset').onclick();assert.match(el('account_status').textContent,/If the account is eligible/);
});

test('failed saving blocks logout and retains session (mock)',async()=>{const {el,auth,context}=await setup();let calls=0;auth.signOut=async()=>{calls++;return {error:null}};context.saveDraft=async()=>false;await el('account_logout').onclick();assert.equal(calls,0);assert.match(el('account_status').textContent,/saving failed/);context.saveDraft=async()=>true;await el('account_logout').onclick();assert.equal(calls,1)});
