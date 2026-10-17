/* Pricing advice never mutates the seller price except explicit acceptance into an empty field. */
let pricingResult=null,pricingRequest=0,pricingController=null,marketingResult=null;
const pricingInputs=['currency','market','location','subcategory','dimensions','workmanship','accessories','seller_cost','seller_target_margin','sales_channel','target_customer'];
function pricingInput(){const v=Object.fromEntries(pricingInputs.map(k=>[k,$('p_'+k).value]));for(const k of ['seller_cost','seller_target_margin'])v[k]=v[k]===''?null:Number(v[k]);return {...v,category:$('category').value,material:$('material').value,condition:$('condition').value,use_ai:$('p_use_ai').checked}}
function clearMarketing(){marketingResult=null;$('marketingResult').textContent='Generate new copy after approving your price.'}
function invalidatePricing(){if(typeof markSocialContextChanged==='function')markSocialContextChanged();pricingRequest++;pricingController?.abort();pricingController=null;pricingResult=null;clearMarketing();$('pricingResult').textContent='Inputs changed. Calculate fresh advice.';$('calculatePricing').disabled=false;makeAd();}
function resetPricing(){invalidatePricing();$('priceApproved').checked=false;for(const k of pricingInputs)if(!['currency','market'].includes(k))$('p_'+k).value='';$('originalPrice').value='';$('discountPercent').value='';$('positioning').value='unclassified';}
function pricingExport(){const p=pricingResult||DukaanPricing.estimate(pricingInput());return {...p,seller_confirmed_price:$('priceApproved').checked&&priceValid()?Number($('price').value):null,seller_approval_status:$('priceApproved').checked&&priceValid()?'approved':p.seller_approval_status}}
function renderPricing(){
 renderPricingContext();const p=pricingResult;const box=$('pricingResult');box.replaceChildren();for(const line of [
 ...(p.estimated_typical===null?['Market comparison unavailable — no sufficient verified comparable records.']:[]),
 ...(p.cost_based_price!==null?[`${p.currency} ${p.seller_cost} ÷ (1 − ${p.seller_target_margin}% / 100) = ${p.currency} ${p.cost_based_price.toFixed(2)}. Gross margin, not markup.`]:[]),
 'Pricing assistance · '+p.recommendation_basis.replaceAll('_',' '),
 `Market range (${p.currency}): low ${p.estimated_low??'unknown'} · typical ${p.estimated_typical??'unknown'} · high ${p.estimated_high??'unknown'}`,
 `Recommendation: ${p.recommended_selling_price==null?'none — more evidence needed':p.currency+' '+p.recommended_selling_price.toFixed(2)}`,
 `Confidence: ${p.confidence.level}. ${p.confidence.explanation}`,`AI: ${p.ai_status}`,`Estimated: ${p.estimation_timestamp}`,
 ...p.pricing_factors.map(x=>'Factor: '+x),...p.assumptions.map(x=>'Method/assumption: '+x),...p.missing_information.map(x=>'Missing: '+x),...p.evidence_sources.map(x=>'Asking-price source: '+x.url+' · observed '+x.observed_at)
])box.append(textElement('p',line));}
$('calculatePricing').onclick=async()=>{
 if(pricingController)return;
 let input;try{input=pricingInput();DukaanPricing.estimate(input)}catch(e){toast(e.message);return}
 invalidatePricing();const request=++pricingRequest;const controller=new AbortController();pricingController=controller;const timeout=setTimeout(()=>controller.abort(),requestTimeoutMs);$('calculatePricing').disabled=true;$('pricingResult').textContent='Calculating advice…';
 try{const response=await fetch('/api/pricing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:controller.signal});if(!response.ok)throw Error('Pricing service unavailable');const result=await response.json();if(request!==pricingRequest)return;pricingResult=result;renderPricing()}
 catch{if(request!==pricingRequest)return;pricingResult=DukaanPricing.estimate(input);pricingResult.ai_status='service_unavailable_local_rules_used';renderPricing()}
 finally{clearTimeout(timeout);if(request===pricingRequest){$('calculatePricing').disabled=false;pricingController=null;if(typeof saveDraft==='function')void saveDraft()}}
};
$('acceptPricing').onclick=()=>{if(!pricingResult||pricingResult.recommended_selling_price==null){toast('No supported recommendation to accept.');return}if($('price').value!==''){toast('Your existing price is preserved. Edit it yourself to change it.');return}const value=DukaanPricing.accept($('price').value,pricingResult.recommended_selling_price);$('price').value=value;pricingResult.seller_approval_status='accepted';$('priceApproved').checked=false;clearMarketing();makeAd();toast('Recommendation copied. Review and explicitly approve your price.');};
$('rejectPricing').onclick=()=>{if(pricingResult)pricingResult.seller_approval_status='rejected';clearMarketing();toast('Recommendation rejected. Your price is unchanged.');};
for(const k of pricingInputs)$('p_'+k).addEventListener('input',invalidatePricing);
for(const k of ['material','condition','category'])$(k).addEventListener('input',invalidatePricing);
$('p_use_ai').addEventListener('change',invalidatePricing);
$('price').addEventListener('input',()=>{$('priceApproved').checked=false;if(pricingResult)pricingResult.seller_approval_status='pending';clearMarketing()});
for(const k of ['title','description','positioning','originalPrice','discountPercent'])$(k).addEventListener('input',()=>{clearMarketing()});
$('priceApproved').onchange=()=>{if($('priceApproved').checked&&!priceValid()){$('priceApproved').checked=false;toast('Enter a valid seller price first.');}clearMarketing();makeAd();toast($('priceApproved').checked?'Selling price approved. Continue to marketing.':'Selling price needs approval.')};
$('generateMarketing').onclick=()=>{try{marketingResult=DukaanPricing.marketing({title:$('title').value,description:$('description').value,price:priceValid()?Number($('price').value):null,currency:$('p_currency').value,approved:$('priceApproved').checked,positioning:$('positioning').value,pricing:pricingResult,customer:$('p_target_customer').value,original:$('originalPrice').value===''?null:Number($('originalPrice').value),discount:$('discountPercent').value===''?null:Number($('discountPercent').value)});$('marketingResult').textContent=JSON.stringify(marketingResult,null,2)}catch(e){toast(e.message)}};
let lastCurrency=$('p_currency').value;
$('p_currency').addEventListener('change',()=>{if($('price').value!==''){$('p_currency').value=lastCurrency;toast('Clear the seller price before changing its currency.');return}lastCurrency=$('p_currency').value;$('currencyLabel').textContent=$('p_currency').value;$('includePrice').checked=false;makeAd();toast('Currency changed without conversion. Review your entered amount.');});

function renderPricingContext(){const d=(appliedAnalysis||analysis)?.intelligence;const lines=[`Category: ${$('category').value}`,`Seller-reported material: ${$('material').value||'unknown'}`,`Dimensions: ${$('p_dimensions').value||'unknown'}`,`Seller-reported workmanship: ${$('p_workmanship').value||'unknown'}`,...(d?.material_hypotheses||[]).map(h=>`Unverified material hypothesis (not used as a pricing fact): ${h.material_name} — ${h.likelihood_label}; ${h.confidence} confidence`),...(d?.textile_analysis?.saree?.border_description?[`Visual border observation: ${d.textile_analysis.saree.border_description}`]:[])];$('pricingContext').replaceChildren(...lines.map(x=>textElement('p',x)));}
