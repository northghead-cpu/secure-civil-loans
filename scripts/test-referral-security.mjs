import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

const root = new URL('../', import.meta.url);
const helper = await readFile(new URL('supabase/functions/send-handshake-referral/security.ts', root), 'utf8');
const security = await import('data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(helper, { mode: 'transform' })).toString('base64'));
const { RequestError, readBoundedText, requireJson, parseObject, handshakeTarget, enforceRateLimit } = security;
const secret = 'test-only-secret-not-production-000000000';
const event = '11111111-1111-4111-8111-111111111111';
const payload = { event_id: event, tenant_short_name: 'lender', reference: `RBH-${event}`, applicant_alias: 'Referral', requested_amount_zmw: 1000 };
async function signed(body, timestamp = String(Math.floor(Date.now()/1000))) {
  const key = await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature = Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(timestamp+'.'+body))).toString('hex');
  return new Request('https://example.test',{method:'POST',headers:{'content-type':'application/json','x-riverbanc-timestamp':timestamp,'x-riverbanc-signature':signature},body});
}
async function loadHandler(path, client, overrides = {}) {
  let handler;
  const source = stripTypeScriptTypes(await readFile(new URL(path,root),'utf8'),{mode:'transform'}).replace(/^import .*;\n/gm,'');
  const env = { SUPABASE_URL:'https://db.example.test', SUPABASE_SERVICE_ROLE_KEY:'test-only', SUPABASE_ANON_KEY:'test-only', RIVERBANC_MARKETPLACE_HMAC_SECRET:secret, RIVERBANC_HANDSHAKE_HMAC_SECRET:secret, HANDSHAKE_API_URL:'https://ueveurmphygyofwoyljj.supabase.co/functions/v1/marketplace-intake', RIVERBANC_HANDSHAKE_TENANT_MAP:JSON.stringify({Lender:'lender'}), ...overrides };
  new Function('createClient','Deno',...Object.keys(security),source)(()=>client,{env:{get:key=>env[key]},serve:fn=>handler=fn},...Object.values(security));
  return handler;
}
function intakeClient(accept) { return {rpc:async(name,args)=>name==='consume_referral_api_limit'?{data:{allowed:true},error:null}:accept(args)}; }
const intakePath='supabase/functions/marketplace-intake/index.ts';
const senderPath='supabase/functions/send-handshake-referral/index.ts';

test('stream limit catches oversized chunked bodies without content-length',async()=>{ const req=new Request('https://example.test',{method:'POST',body:'x'.repeat(100)}); await assert.rejects(readBoundedText(req,10),e=>e.status===413); });
test('body deadline cancels slow streams',async()=>{const req=new Request('https://example.test',{method:'POST',body:new ReadableStream({start(){}}),duplex:'half'});await assert.rejects(readBoundedText(req,100,10),e=>e.status===408);});
test('invalid UTF-8 rejected',async()=>{await assert.rejects(readBoundedText(new Response(new Uint8Array([255])),10),e=>e.code==='INVALID_ENCODING');});
test('null, arrays, unknown fields and invalid JSON rejected',()=>{for(const body of ['null','[]','{"secret":1}','{'])assert.throws(()=>parseObject(body,['handoff_id']),RequestError);});
test('JSON content type and supported API version enforced',()=>{assert.throws(()=>requireJson(new Request('https://example.test')),e=>e.status===415);assert.throws(()=>requireJson(new Request('https://example.test',{headers:{'content-type':'application/json','x-riverbanc-api-version':'2'}})),e=>e.code==='UNSUPPORTED_API_VERSION');});
test('outbound destination rejects SSRF, URL credentials, query secrets and alternate routes',()=>{for(const url of ['http://ueveurmphygyofwoyljj.supabase.co/functions/v1/marketplace-intake','https://evil.test/functions/v1/marketplace-intake','https://user:pass@ueveurmphygyofwoyljj.supabase.co/functions/v1/marketplace-intake','https://ueveurmphygyofwoyljj.supabase.co/functions/v1/marketplace-intake?token=secret','https://ueveurmphygyofwoyljj.supabase.co/functions/v1/other'])assert.throws(()=>handshakeTarget(url));});
test('rate limiter fails closed and returns 429 for exhaustion',async()=>{await assert.rejects(enforceRateLimit({rpc:async()=>({data:null,error:{}})},'sender_global','all'),e=>e.status===503);await assert.rejects(enforceRateLimit({rpc:async()=>({data:{allowed:false},error:null})},'sender_global','all'),e=>e.status===429);});
test('sender rejects untrusted origins and absent user credentials',async()=>{const handler=await loadHandler(senderPath,{});assert.equal((await handler(new Request('https://example.test',{method:'POST',headers:{origin:'https://evil.test'}}))).status,403);assert.equal((await handler(new Request('https://example.test',{method:'POST'}))).status,401);});
test('sender denies a valid user without a privileged role',async()=>{const client={auth:{getUser:async()=>({data:{user:{id:event}},error:null})},from:()=>({select(){return this},eq(){return this},in:async()=>({data:[],error:null})})};const handler=await loadHandler(senderPath,client);const res=await handler(new Request('https://example.test',{method:'POST',headers:{authorization:'Bearer test-only','content-type':'application/json'},body:JSON.stringify({handoff_id:event})}));assert.equal(res.status,403);});
function staffClient(status = 'authorized') {
  const updates=[];
  const handoff={id:event,user_id:'borrower',lender_name:'Lender',requested_amount:1000,status,authorized_at:new Date().toISOString(),authorization_signature:'signed',authorization_version:'v1',handshake_transfer_status:'pending'};
  return { updates, auth:{getUser:async()=>({data:{user:{id:event}},error:null})}, rpc:async()=>({data:{allowed:true},error:null}), from(table){
    const builder={select(){return this},eq(){return this},in(){return this},or(){return this},update(data){updates.push(data);return this},insert(){return this},maybeSingle:async()=>({data:handoff,error:null}),then(resolve,reject){return Promise.resolve({data:table==='user_roles'?[{role:'admin'}]:null,error:null}).then(resolve,reject)}};
    return builder;
  }};
}
function senderRequest() {return new Request('https://example.test',{method:'POST',headers:{authorization:'Bearer test-only','content-type':'application/json'},body:JSON.stringify({handoff_id:event})});}
test('sender blocks unauthorized workflow stages before making upstream calls',async()=>{for(const status of ['draft','cancelled','declined']){const handler=await loadHandler(senderPath,staffClient(status));assert.equal((await handler(senderRequest())).status,409);}});
test('sender signs minimal payload and refuses to follow redirects',async()=>{const original=globalThis.fetch;let sent;try{globalThis.fetch=async(url,options)=>{sent=options;return Response.json({accepted:true,event_id:event,reference:payload.reference,status:'queued'});};const client=staffClient();const handler=await loadHandler(senderPath,client);const response=await handler(senderRequest());assert.equal(response.status,201);assert.equal(sent.redirect,'error');assert.equal(sent.headers['x-riverbanc-signature'].length,64);assert.deepEqual(Object.keys(JSON.parse(sent.body)).sort(),Object.keys(payload).sort());assert.equal(JSON.stringify(sent).includes('borrower'),false);assert.equal(client.updates.some(u=>u.handshake_transfer_status==='accepted'),true);}finally{globalThis.fetch=original;}});
test('sender does not record acceptance for wrong event, null or malformed upstream responses',async()=>{const original=globalThis.fetch;try{for(const body of ['null','{',JSON.stringify({accepted:true,event_id:'wrong',reference:payload.reference})]){globalThis.fetch=async()=>new Response(body,{status:200});const client=staffClient();const handler=await loadHandler(senderPath,client);assert.equal((await handler(senderRequest())).status,502);assert.equal(client.updates.some(u=>u.handshake_transfer_status==='accepted'),false);}}finally{globalThis.fetch=original;}});
