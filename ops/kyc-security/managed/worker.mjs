// No HTTP data endpoint. A scheduled invocation handles at most one encrypted object.
const SOURCE='https://zdpeaxkormwjrgllwalq.supabase.co/functions/v1/marketplace-backup-source';
const END=Date.parse('2026-12-01T00:00:00+02:00');
const MAX_ENVELOPE=4*1024*1024;
export async function tick(env,now=Date.now(),request=fetch){
  if(env.BACKUP_ENABLED!=='true'||!env.SOURCE_TOKEN||now>=END||now<Date.parse('2026-11-09T00:00:00Z'))return {status:'disabled'};
  const bucket=env.BACKUPS;
  const day=new Date(now+7200000).toISOString().slice(0,10);
  const stateKey='managed-v1/state/'+day+'.json';
  const existing=await bucket.get(stateKey);
  let state=existing?await existing.json():null;
  if(state?.status==='complete'||state?.status==='failed'||state?.lease_until>now)return {status:state?.status||'busy'};
  const call=body=>request(SOURCE,{method:'POST',redirect:'error',headers:{Authorization:`Bearer ${env.SOURCE_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(25000),cache:'no-store'});
  if(!state){
    const before=new Date(now).toISOString();const response=await call({action:'page',before});
    if(!response.ok)throw Error('SOURCE_PAGE_FAILED');
    const data=await response.json();
    if(!Array.isArray(data.items)||!data.items.length||data.items.length>=100||data.total_bytes>4*1024*1024)throw Error('BUDGET_LIMIT');
    state={run_id:crypto.randomUUID(),day,before,items:data.items,key_id:data.key_id,records:[],index:0,attempts:0,status:'running'};
  }
  state.lease_until=now+240000;state.attempts++;
  if(state.attempts>3){state.status='failed';}
  const claimed=await bucket.put(stateKey,JSON.stringify(state),{onlyIf:existing?{etagMatches:existing.etag}:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json',cacheControl:'private, no-store'}});
  if(!claimed)return {status:'busy'};
  if(state.status==='failed')return {status:'failed'};
  const item=state.items[state.index];
  const key=`managed-v1/runs/${state.run_id}/${String(state.index).padStart(3,'0')}.enc`;
  let stored=await bucket.get(key);
  if(!stored){
    const response=await call({action:'seal',id:item.id,version:item.version,run_id:state.run_id});
    if(!response.ok)throw Error('SOURCE_SEAL_FAILED');
    const sha=response.headers.get('X-Backup-SHA256');
    if(!/^[a-f0-9]{64}$/.test(sha||''))throw Error('HASH_MISSING');
    // Bound the stream before R2 persistence. Payload is already encrypted inside Supabase.
    const bytes=await bounded(response.body,MAX_ENVELOPE);
    if(await hash(bytes)!==sha)throw Error('TRANSFER_INTEGRITY');
    await bucket.put(key,bytes,{onlyIf:{etagDoesNotMatch:'*'},customMetadata:{sha256:sha,key_id:state.key_id},httpMetadata:{contentType:'application/octet-stream',cacheControl:'private, no-store'}});
    stored=await bucket.get(key);
  }
  if(!stored||stored.size>MAX_ENVELOPE)throw Error('DESTINATION_MISSING');
  const bytes=await bounded(stored.body,MAX_ENVELOPE);
  const sha=await hash(bytes);
  if(sha!==stored.customMetadata?.sha256||stored.customMetadata?.key_id!==state.key_id)throw Error('READBACK_INTEGRITY');
  state.records.push({key,sha256:sha,id:item.id,version:item.version});state.index++;state.attempts=0;state.lease_until=0;
  if(state.index===state.items.length){
    state.status='complete';state.encrypted_readback_verified=true;state.restore_verified=false;state.completed_at=new Date(now).toISOString();
  }
  const saved=await bucket.put(stateKey,JSON.stringify(state),{onlyIf:{etagMatches:claimed.etag},httpMetadata:{contentType:'application/json',cacheControl:'private, no-store'}});
  if(!saved)throw Error('CHECKPOINT_CONFLICT');
  return {status:state.status,count:state.index};
}
async function bounded(stream,max){const reader=stream.getReader();const chunks=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max)throw Error('SIZE_LIMIT');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;}
async function hash(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');}
export default {
  fetch(){return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});},
  async scheduled(_event,env,ctx){ctx.waitUntil(tick(env).then(result=>console.log(JSON.stringify({event:'backup_tick',...result}))).catch(()=>console.error(JSON.stringify({event:'backup_tick_failed'}))));}
};
