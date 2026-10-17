import {createApp as realApp} from '../server/app.js';
export const verifiedRecords=['business','udyam'].map(kind=>({kind,status:'verified',provider_reference:'mock-only',verified_at:'2020-01-01T00:00:00Z',expires_at:null}));
// Route tests use mock authenticated/verified accounts; production never imports this.
export function createApp(options){
 const app=realApp({...options,accounts:{configured:true,url:'https://example.supabase.co',key:'sb_publishable_fixture'},sellerClientFactory:()=>({auth:{getUser:async()=>({data:{user:{id:'fixture'}}})},from:()=>({select(){return this},eq:async()=>({data:verifiedRecords})})})});
 const handler=(req,res)=>{req.headers.authorization='Bearer fixture';return app(req,res)};
 // Preserve the usual listen API while supplying the mock credential to HTTP tests.
 return {listen(...args){return importServer(handler,args)}};
}
import {createServer} from 'node:http';
function importServer(handler,args){return createServer(handler).listen(...args)}
