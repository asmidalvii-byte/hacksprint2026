import 'dotenv/config';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createApp} from '../server/app.js';
import {getConfig} from '../server/config.js';
import {validatePricing} from '../server/pricing.js';
const config=getConfig();
if(!config.configured)throw Error('Configure credentials locally first.');
const directory=new URL('../../../outputs/pricing-upgrade/',import.meta.url);await mkdir(directory,{recursive:true});
const server=createApp({config}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
try {
 const pricingResponse=await fetch(base+'/api/pricing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({currency:'INR',market:'India',location:'Mumbai',category:'saree',sales_channel:'local shop',use_ai:true})});
 const pricing=await pricingResponse.json();
 await writeFile(new URL('LIVE-PRICING.json',directory),JSON.stringify(pricing,null,2));
 const summary={pricing_http_status:pricingResponse.status,model:config.model,pricing_schema_valid:validatePricing(pricing),ai_status:pricing.ai_status,market_prices_validated:false,real_comparable_records:0,browser_rendering_verified:false};
 if(process.argv[2]){
 const bytes=await readFile(process.argv[2]);const form=new FormData();form.append('image',new Blob([bytes],{type:'image/jpeg'}),'new-product.jpeg');
 const response=await fetch(base+'/api/analyze-product',{method:'POST',body:form});const analysis=await response.json();
 await writeFile(new URL('LIVE-IMAGE-REGRESSION.json',directory),JSON.stringify(analysis,null,2));summary.image_http_status=response.status;summary.image_source=analysis.source||null;summary.image_review_status=analysis.merchantReview?.status||null;
 }
 await writeFile(new URL('LIVE-TEST-RESULT.json',directory),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
} finally {server.closeAllConnections();await new Promise(r=>server.close(r))}
