import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../shared/pricing.js';
import {createPricing,validatePricing} from '../server/pricing.js';
import {createApp} from '../server/app.js';
const {estimate,accept,marketing}=globalThis.DukaanPricing;
const now=new Date('2026-10-17T00:00:00Z');
const facts={currency:'INR',market:'India',location:'Mumbai',sales_channel:'shop',category:'saree',subcategory:'cotton saree',material:'cotton',dimensions:'6 m',workmanship:'machine woven',accessories:'none',condition:'New'};
const records=[100,200,300].map((price,i)=>({...facts,title:'Synthetic test listing',url:`https://retailer${i%2}.example/${i}`,listed_price:price,observed_at:now.toISOString(),review_status:'verified',source_type:'retailer_listing',reviewer:'test fixture only',comparability_notes:'All supplied attributes match test fixture'}));
test('no evidence gives null prices, low confidence and missing fabric',()=>{const p=estimate({category:'saree'},[],now);assert.equal(p.recommended_selling_price,null);assert.equal(p.estimated_typical,null);assert.ok(p.missing_information.some(x=>x.includes('material')));assert.ok(validatePricing(p));});
test('reviewed comparables yield asking-price min median max, not transaction claims',()=>{const p=estimate(facts,records,now);assert.deepEqual([p.estimated_low,p.estimated_typical,p.estimated_high],[100,200,300]);assert.equal(p.confidence.level,'medium');assert.match(p.assumptions[0],/not completed/)});
test('missing fabric, unreliable, old, future, wrong currency, region and differing construction excluded',()=>{
 for(const change of [{review_status:'unverified'},{source_type:'social_post'},{observed_at:'2025-01-01'},{observed_at:'2027-01-01'},{currency:'USD'},{market:'UK'},{location:'Delhi'},{workmanship:'handloom'},{accessories:'blouse'}])assert.equal(estimate(facts,records.map(r=>({...r,...change})),now).estimated_typical,null);
 assert.equal(estimate({...facts,material:''},records,now).estimated_typical,null);
 assert.equal(estimate(facts,[records[0],records[0],records[0]],now).estimated_typical,null);
});
test('cost and gross margin, including zero margin; rejects invalid inputs',()=>{assert.equal(estimate({seller_cost:800,seller_target_margin:20}).recommended_selling_price,1000);assert.equal(estimate({seller_cost:800,seller_target_margin:0}).recommended_selling_price,800);assert.equal(estimate({seller_cost:800}).recommended_selling_price,null);for(const input of [{seller_cost:-1},{seller_target_margin:100},{currency:'XYZ'}])assert.throws(()=>estimate(input));});
test('acceptance never overwrites seller price',()=>{assert.equal(accept('975',1000),'975');assert.equal(accept('',1000),'1000');assert.equal(accept('',null),'')});
test('marketing needs approval, refuses unsupported positioning and separates discount calculation',()=>{const input={title:'Reviewed saree',description:'Seller-reviewed description',price:1000,currency:'INR',approved:true,positioning:'premium',pricing:estimate({}),original:1200,discount:10};assert.throws(()=>marketing({...input,approved:false}));const m=marketing(input);assert.equal(m.positioning,'unclassified');assert.equal(m.promotion.calculated_price,1080);assert.match(m.caption,/1000.00/);assert.doesNotMatch(m.caption,/premium|bargain|discount/i)});
test('mock Gemini validates full schema and cannot change price or sources; errors fall back',async()=>{
 for(const mutation of ['good','price','sources','truncated','error']){
 const client={models:{generateContent:async args=>{assert.ok(args.config.responseSchema.properties.seller_confirmed_price.nullable);const p=JSON.parse(args.contents).pricing;if(mutation==='error')throw Error('secret');if(mutation==='price')p.recommended_selling_price=999;if(mutation==='sources')p.evidence_sources.push({url:'https://fake.example',observed_at:'today',source_type:'fake',reviewer:'fake'});p.pricing_factors.push('Mock suggestion');return {text:JSON.stringify(p),candidates:[{finishReason:mutation==='truncated'?'MAX_TOKENS':'STOP'}]}}}};
 const p=await createPricing({configured:true,timeoutMs:1000,model:'mock'},client)({seller_cost:800,seller_target_margin:20,use_ai:true});assert.equal(p.recommended_selling_price,1000);assert.deepEqual(p.evidence_sources,[]);assert.equal(p.ai_status,mutation==='good'?'live_response_validated':'unavailable_or_invalid_response_rules_preserved');assert.ok(validatePricing(p));
 }
});
test('pricing HTTP integration validates requests and exports schema without AI',async t=>{
 const server=createApp({config:{configured:false,timeoutMs:1000,maxUploadBytes:10000}}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>{server.closeAllConnections();server.close(r)}));const url=`http://127.0.0.1:${server.address().port}/api/pricing`;
 const post=body=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const response=await post({...facts,seller_cost:800,seller_target_margin:20});assert.equal(response.status,200);const p=await response.json();assert.ok(validatePricing(p));assert.equal(p.recommended_selling_price,1000);assert.equal(p.seller_approval_status,'pending');
 for(const value of [{comparable_products:records},{seller_cost:-1},{seller_target_margin:100},{currency:'XYZ'}])assert.equal((await post(value)).status,400);
});

test('margin accepts 99 percent but rejects 100 and negatives',()=>{assert.equal(estimate({seller_cost:10,seller_target_margin:99}).cost_based_price,1000);for(const margin of [100,101,-1])assert.throws(()=>estimate({seller_cost:10,seller_target_margin:margin}));});
