import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@6.1.3';
import { RequestError, readBoundedBytes } from '../_shared/request-security.ts';
import { allowedClaims, AUDIENCE, validResult } from './policy.mjs';
const url=Deno.env.get('SUPABASE_URL')!;
if(url!=='https://zdpeaxkormwjrgllwalq.supabase.co')throw Error('MARKETPLACE_ONLY');
const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const jwks=createRemoteJWKSet(new URL('https://token.actions.githubusercontent.com/.well-known/jwks'));
const headers={'Content-Type':'application/json','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'};
const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
Deno.serve(async(req)=>{
 if(req.headers.has('origin'))return reply(403,{error:'SERVER_ONLY'});
 if(req.method!=='POST')return reply(405,{error:'POST_REQUIRED'});
 const token=req.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];
 if(!token||token.length>16000)return reply(401,{error:'AUTH_REQUIRED'});
 let run:string;
 try{
  const {payload}=await jwtVerify(token,jwks,{issuer:'https://token.actions.githubusercontent.com',audience:AUDIENCE,algorithms:['RS256'],maxTokenAge:'10m',requiredClaims:['exp','iat','sub','run_id']});
  if(!allowedClaims(payload))return reply(403,{error:'WORKFLOW_DENIED'});
  run=String(payload.run_id);
 }catch{return reply(401,{error:'INVALID_IDENTITY'});}
 try{
  if(req.headers.get('content-type')?.split(';')[0]!=='application/json')return reply(415,{error:'JSON_REQUIRED'});
  const body=JSON.parse(new TextDecoder().decode(await readBoundedBytes(req,32768,5000)));
  if(!['claim','read','complete'].includes(body.action))return reply(400,{error:'INVALID_ACTION'});
  if(body.action!=='claim'&&(!UUID.test(body.id)||!UUID.test(body.lease)))return reply(400,{error:'INVALID_LEASE'});
  if(body.action==='complete'&&!validResult(body.result))return reply(400,{error:'INVALID_RESULT'});
  const {data,error}=await admin.rpc('payslip_forensics_worker',{p_action:body.action,p_job_id:body.id??null,p_lease:body.lease??null,p_result:body.action==='complete'?{...body.result,workflow_run:run,engine:'PDF Forensics Suite 1.2.0 / Riverbanc v1'}:null});
  if(error)return reply(409,{error:'JOB_UNAVAILABLE'});
  if(body.action!=='read')return reply(200,data);
  if(!data||data.size<1||data.size>5242880)return reply(409,{error:'SOURCE_UNAVAILABLE'});
  const {data:blob,error:denied}=await admin.storage.from('kyc-documents').download(data.path);
  if(denied||!blob||blob.size!==data.size)return reply(409,{error:'SOURCE_UNAVAILABLE'});
  const {data:latest,error:changed}=await admin.rpc('payslip_forensics_worker',{p_action:'read',p_job_id:body.id,p_lease:body.lease});
  if(changed||latest?.version!==data.version)return reply(409,{error:'SOURCE_CHANGED'});
  return new Response(blob,{headers:{...headers,'Content-Type':'application/pdf'}});
 }catch(e){return e instanceof RequestError?reply(e.status,{error:e.code}):reply(503,{error:'WORKER_UNAVAILABLE'});}
});
