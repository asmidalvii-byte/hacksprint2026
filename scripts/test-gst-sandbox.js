import 'dotenv/config';
import {createGstSandbox,gstSandboxConfig} from '../server/gst-sandbox.js';
const settings=gstSandboxConfig();
if(!settings.enabled||!settings.apiKey||!settings.apiSecret||!process.env.GST_SANDBOX_TEST_GSTIN){
 console.log('NOT RUN: Set GST_SANDBOX_ENABLED=true, GST_SANDBOX_API_KEY, GST_SANDBOX_API_SECRET and GST_SANDBOX_TEST_GSTIN locally.');
 process.exitCode=2;
}else{
 try{
  const result=await createGstSandbox({settings})({gstin:process.env.GST_SANDBOX_TEST_GSTIN,consent:true});
  if(result.authoritative!==false||result.data.access_allowed!==false)throw Error('Unsafe result');
  console.log('PASS: real request to Sandbox.co.in TEST API returned a matching GST record. No production verification, database approval or browser flow tested.');
 }catch(error){console.error('NOT PASSED: '+(/^GST_SANDBOX_[A-Z_]+$/.test(error.code||'')?error.code:'GST_SANDBOX_CHECK_FAILED')+'. No credentials or registration details logged.');process.exitCode=1}
}
