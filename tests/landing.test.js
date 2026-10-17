import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createApp} from './verified-app-fixture.js';
test('rangoli supplied pattern remains deterministic and finite',async()=>{
 const result=await build({entryPoints:['components/ui/rangoli-preloader.tsx'],bundle:true,write:false,platform:'node',format:'esm'});
 const {rgpBuild}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
 const a=rgpBuild(8,1000,7),b=rgpBuild(8,1000,7);assert.ok(a.count>100);assert.deepEqual(a.xs,b.xs);assert.ok([...a.xs,...a.ys,...a.shade].every(Number.isFinite));
});
test('welcome and app are distinct public pages; only built landing assets are exposed',async t=>{
 const server=createApp({config:{configured:false,maxUploadBytes:1000,timeoutMs:1000}}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>{server.closeAllConnections();server.close(r)}));const base='http://127.0.0.1:'+server.address().port;
 assert.match(await(await fetch(base+'/')).text(),/Welcome to Kriti/);
 assert.match(await(await fetch(base+'/index.html')).text(),/id="account_form"/);
 for(const path of ['/landing/landing.js','/landing/landing.css','/assets/kriti-logo.jpeg'])assert.equal((await fetch(base+path)).status,200);
 for(const path of ['/landing/main.tsx','/components/ui/rangoli-preloader.tsx'])assert.equal((await fetch(base+path)).status,404);
});
