import { timingSafeEqual } from 'node:crypto';
import { seal, digest, publicKeyId } from './envelope.mjs';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const MAX_OBJECT = 2 * 1024 * 1024;
export const MAX_SNAPSHOT = 4 * 1024 * 1024;
export function makeBackupSource({token, publicKey, page, object, read}) {
  const headers = {'Content-Type':'application/json','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
  const reply = (status,body) => new Response(JSON.stringify(body),{status,headers});
  return async req => {
    if (!token || !/^[A-Za-z0-9_-]{43,128}$/.test(token) || !publicKey) return reply(503,{error:'BACKUP_NOT_CONFIGURED'});
    if (req.method !== 'POST' || req.headers.has('origin')) return reply(403,{error:'SERVER_ONLY'});
    const supplied=req.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43,128})$/)?.[1];
    if (!supplied || !timingSafeEqual(Buffer.from(digest(Buffer.from(supplied)),'hex'),Buffer.from(digest(Buffer.from(token)),'hex'))) return reply(401,{error:'AUTH_REQUIRED'});
    try {
      publicKeyId(publicKey);
      if(req.headers.get('content-type')?.split(';')[0]!=='application/json') return reply(415,{error:'JSON_REQUIRED'});
      const raw=await limited(req.body,4096);
      const body=JSON.parse(new TextDecoder().decode(raw));
      if(body.action==='page') {
        if(typeof body.before!=='string'||!Number.isFinite(Date.parse(body.before))) throw Error('REQUEST');
        const items=await page(null,body.before);
        if(!Array.isArray(items)||!items.length||items.length>=100) throw Error('SNAPSHOT_LIMIT');
        let total=0;
        const clean=items.map(x=>{
          const size=Number(x.metadata?.size);
          if(!UUID.test(x.id)||!x.version||!Number.isSafeInteger(size)||size<=0||size>MAX_OBJECT) throw Error('OBJECT_LIMIT');
          total+=size;return {id:x.id,version:x.version,size};
        });
        if(total>MAX_SNAPSHOT) throw Error('SNAPSHOT_LIMIT');
        return reply(200,{items:clean,total_bytes:total,key_id:publicKeyId(publicKey)});
      }
      if(body.action!=='seal'||!UUID.test(body.id)||!UUID.test(body.run_id)||typeof body.version!=='string'||body.version.length>128) throw Error('REQUEST');
      const current=await object(body.id);
      if(!current||current.version!==body.version||Number(current.metadata?.size)>MAX_OBJECT) throw Error('SOURCE_CHANGED');
      const bytes=await read(current);
      if(!bytes.length||bytes.length>MAX_OBJECT||bytes.length!==Number(current.metadata?.size)) throw Error('SIZE');
      const latest=await object(body.id);
      if(!latest||latest.version!==body.version) throw Error('SOURCE_CHANGED');
      // Original paths, hashes and bytes leave Supabase only inside this envelope.
      const payload=Buffer.from(JSON.stringify({source:{id:current.id,bucket_id:current.bucket_id,name:current.name,version:current.version},sha256:digest(bytes),size:bytes.length,bytes:Buffer.from(bytes).toString('base64')}));
      const encrypted=seal(payload,publicKey,{kind:'object',run_id:body.run_id,object_id:body.id});
      return new Response(encrypted,{headers:{...headers,'Content-Type':'application/octet-stream','X-Backup-SHA256':digest(encrypted)}});
    } catch {return reply(503,{error:'BACKUP_SOURCE_FAILED'});}
  };
}
async function limited(stream,max) {
  if(!stream) throw Error('BODY');
  const reader=stream.getReader();let size=0;const chunks=[];
  const timer=AbortSignal.timeout(5000);
  try {while(true){timer.throwIfAborted();const next=await Promise.race([reader.read(),new Promise((_,reject)=>timer.addEventListener('abort',()=>reject(Error('TIMEOUT')),{once:true}))]);if(next.done)break;size+=next.value.length;if(size>max)throw Error('SIZE');chunks.push(next.value);}}
  finally {await reader.cancel().catch(()=>{});}
  const result=new Uint8Array(size);let at=0;for(const chunk of chunks){result.set(chunk,at);at+=chunk.length;}return result;
}
