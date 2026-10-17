(function(scope){
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
function estimate(input={},records=[],now=new Date()){
 const currency=input.currency||'INR';
 if(!['INR','USD','GBP','EUR'].includes(currency))throw Error('Unsupported currency');
 const num=(key,max)=>{const v=input[key];if(v==null||v==='')return null;if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>max)throw Error('Invalid '+key);return v};
 const text=k=>typeof input[k]==='string'?input[k].trim().slice(0,200):'';
 const cost=num('seller_cost',10000000),margin=num('seller_target_margin',100),category=text('category'),material=text('material'),market=text('market'),location=text('location'),channel=text('sales_channel');
 if(margin!==null&&margin>=100)throw Error('Gross margin must be at least 0% and below 100%.');
 const missing=[];
 for(const k of ['material','market','location','sales_channel','dimensions','workmanship','accessories','condition','subcategory'])if(!text(k))missing.push('Confirm '+k+' with the seller.');
 const comparable=records.filter(r=>{const age=now-new Date(r.observed_at);return r.review_status==='verified'&&r.source_type==='retailer_listing'&&/^https:\/\//.test(r.url||'')&&r.reviewer&&r.comparability_notes&&age>=0&&age<=30*86400000&&r.currency===currency&&r.market===market&&r.location===location&&r.sales_channel===channel&&r.category===category&&material&&r.material?.toLowerCase()===material.toLowerCase()&&['dimensions','workmanship','accessories','condition','subcategory'].every(k=>text(k)&&r[k]===text(k))&&Number.isFinite(r.listed_price)&&r.listed_price>0&&r.listed_price<=10000000}).filter((r,i,a)=>a.findIndex(v=>v.url===r.url)===i);
 const sufficient=comparable.length>=3&&new Set(comparable.map(r=>new URL(r.url).hostname)).size>=2,prices=comparable.map(r=>r.listed_price).sort((a,b)=>a-b);
 const median=sufficient?round((prices[Math.floor((prices.length-1)/2)]+prices[Math.ceil((prices.length-1)/2)])/2):null;
 const costPrice=cost!==null&&cost>0&&margin!==null?round(cost/(1-margin/100)):null;
 if(!sufficient)missing.push('Three reviewed comparable listings from at least two retailers are needed for a market range.');
 if(cost===null||margin===null)missing.push('Supply total unit cost and desired gross margin for a cost-based recommendation.');
 return {currency,market:market||null,location:location||null,category:category||null,subcategory:text('subcategory')||null,estimated_low:sufficient?prices[0]:null,estimated_typical:median,estimated_high:sufficient?prices.at(-1):null,
 evidence_sources:comparable.map(r=>({url:r.url,observed_at:r.observed_at,source_type:'observed_asking_price',reviewer:r.reviewer})),comparable_products:comparable.map(r=>({title:r.title,url:r.url,listed_price:r.listed_price,currency:r.currency,market:r.market,comparability_notes:r.comparability_notes})),
 pricing_factors:['Seller-confirmed fabric and construction','Dimensions, workmanship, condition and included accessories','Total unit cost, target customer, market and sales channel'],
 assumptions:['Listing prices are asking prices, not completed transaction prices.','No currency conversion. No category-level estimate without a verified dataset.','Cost recommendation = total unit cost / (1 - gross margin / 100); margin is not markup. Include packaging, shipping, fees and applicable taxes in total cost; percentage fees need separate costing.'],missing_information:missing,
 confidence:{level:sufficient?'medium':'low',explanation:sufficient?'Min, median and max of reviewed matching asking prices within 30 days; actual sales outcomes unknown.':'Insufficient comparable market evidence. Any recommendation is cost arithmetic, not a validated market price.'},estimation_timestamp:now.toISOString(),seller_cost:cost,seller_target_margin:margin,cost_based_price:costPrice,recommended_selling_price:costPrice??median,recommendation_basis:costPrice!==null?'seller_cost_and_margin':sufficient?'comparable_asking_prices':'insufficient_evidence',seller_confirmed_price:null,seller_approval_status:'pending',sales_channel:channel||null,target_customer:text('target_customer')||null,advice_source:'deterministic_rules',ai_status:'not_requested'};
}
function accept(existing,recommendation){return existing!==''&&existing!=null?existing:recommendation==null?'':String(recommendation)}
function marketing({title,description,price,currency,approved,positioning,pricing,customer,original,discount}){
 if(!approved||!(price>0))throw Error('Explicitly approve a seller price before generating priced marketing.');
 const justified=pricing?.estimated_low!=null&&pricing?.estimated_high!=null;
 const allowed=justified&&(positioning==='budget-friendly'?price<=pricing.estimated_low:positioning==='premium'?price>=pricing.estimated_high:positioning==='mid-range'?price>=pricing.estimated_low&&price<=pricing.estimated_high:false);
 let promotion=null;if(original!=null||discount!=null){if(!(original>0)||!Number.isFinite(original)||!(discount>0&&discount<100))throw Error('Supply a genuine original price and discount between 0 and 100%.');promotion={original_price:original,discount_percent:discount,calculated_price:round(original*(1-discount/100)),status:'calculation_only_not_applied'}}
 const base=`${title}. ${currency} ${Number(price).toFixed(2)}. Contact the seller for details and availability.`;
 return {positioning:allowed?positioning:'unclassified',intended_positioning:positioning,positioning_basis:allowed?'Relative asking-price position only, not a quality or value claim.':'Insufficient evidence for requested positioning; neutral copy used.',target_customer:customer||null,description,caption:base,whatsapp:`Hello! ${base}${customer?' Ask us whether it suits your needs: '+customer+'.':''}`,promotion,source:'seller_editor_fields_and_templates',language:'en'};
}
scope.DukaanPricing={estimate,accept,marketing};
})(globalThis);
