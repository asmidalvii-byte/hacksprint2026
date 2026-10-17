// Opt-in LIVE test. Uses the supplied real photo and the running configured backend.
// The price and review click below simulate merchant actions, not real seller approval.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const imagePath=process.argv[2], outputDirectory=process.argv[3], notes=process.argv[4]||'';
if(!imagePath||!outputDirectory) throw new Error('Usage: node scripts/test-live-browser.js IMAGE_PATH OUTPUT_DIRECTORY');
await mkdir(outputDirectory,{recursive:true});
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const report={test:'live-photo-browser-flow',mockedGemini:false,merchantActions:'automated test simulation',testPrice:'1234.56',passed:false};
try {
 await page.goto('http://127.0.0.1:3000');
 await page.locator('#file').setInputFiles(imagePath);
 await page.locator('#preview').waitFor({state:'visible'});
 if(notes)await page.locator('#notes').fill(notes);
 const responsePromise=page.waitForResponse(r=>r.url().endsWith('/api/analyze-product')&&r.request().method()==='POST',{timeout:140000});
 await page.locator('#generate').click();
 const response=await responsePromise; const result=await response.json();
 report.httpStatus=response.status();
 if(!response.ok()) {
   report.errorCode=result.error?.code;
   await page.locator('#generate:not([disabled])').waitFor();
   report.failureShown=await page.locator('#aiStatus').innerText();
   report.fallbackAvailable=await page.locator('#fallback').isVisible();
   throw new Error('Live analysis failed: '+report.errorCode);
 }
 assert.equal(result.source,'gemini');
 if(notes){report.sellerNotesSupplied=true;assert.ok(result.evidence.some(e=>e.kind==='merchant_text'&&e.inputId==='notes-1'));}
 assert.ok(result.evidence.length>0);
 assert.ok(result.uncertainty.length>0);
 assert.ok(result.missingInformation.length>0);
 assert.equal(Object.hasOwn(result,'price'),false);
 await writeFile(resolve(outputDirectory,'LIVE-PRODUCT-ANALYSIS.json'),JSON.stringify(result,null,2));
 await page.locator('#analysisPanel').waitFor({state:'visible'});
 await page.locator('#listing').waitFor({state:'visible'});
 assert.equal(await page.locator('#price').inputValue(),'');
 assert.equal(await page.locator('#material').inputValue(),'');
 assert.equal(await page.locator('#condition').inputValue(),'');
 assert.equal(await page.locator('#confirmed').isChecked(),false);
 // Save an unapproved draft with no price before exercising simulated seller actions.
 const unapproved=await page.evaluate(()=>catalog());
 await writeFile(resolve(outputDirectory,'PRODUCT-DRAFT.json'),JSON.stringify(unapproved,null,2));
  await page.locator('#price').fill(report.testPrice);await page.locator('#priceApproved').check();await page.locator('#includePrice').check();
 page.on('dialog',dialog=>dialog.accept());
 await page.locator('#applyAnalysis').click();
 assert.equal(await page.locator('#price').inputValue(),report.testPrice);
 const reviewedDescription=(await page.locator('#description').inputValue())+' Please confirm fabric composition and dimensions with the seller.';
 await page.locator('#description').fill(reviewedDescription);
 await page.locator('#confirmed').check();
 await page.locator('#language').selectOption('ta');assert.equal(await page.locator('#confirmed').isChecked(),false);
 await page.locator('#confirmed').check();
 const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();
 const download=await downloadPromise;const file=resolve(outputDirectory,'LIVE-TEST-CATALOG.json');await download.saveAs(file);
 const stream=await download.createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);
 const exported=JSON.parse(Buffer.concat(chunks).toString());
 assert.deepEqual(exported.product.price,{currency:'INR',value:report.testPrice,source:'merchant'});
 assert.equal(exported.analysis.requestId,result.requestId);assert.equal(exported.product.description,reviewedDescription);report.merchantEditPreserved=true;
 assert.equal(exported.provenance.image_analysis,'gemini');assert.equal(exported.provenance.merchant_reviewed,true);
 assert.equal(exported.ad.language,'ta');
 report.model=result.provenance.model;report.requestId=result.requestId;report.analyzedAt=result.provenance.analyzedAt;
 report.evidenceCount=result.evidence.length;report.uncertaintyCount=result.uncertainty.length;report.missingFieldCount=result.missingInformation.length;
 report.priceInitiallyBlank=true;report.testPricePreserved=true;report.exportParsed=true;report.passed=true;
 await page.screenshot({path:resolve(outputDirectory,'LIVE-TEST-SCREENSHOT.png'),fullPage:true});
 console.log(JSON.stringify(report));
} catch(error) { console.log(JSON.stringify({...report,error:String(error.message).slice(0,300)}));process.exitCode=1; }
finally {await writeFile(resolve(outputDirectory,'LIVE-TEST-RESULT.json'),JSON.stringify(report,null,2));await browser.close();}
