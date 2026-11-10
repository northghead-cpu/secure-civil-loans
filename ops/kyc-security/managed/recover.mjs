// Run on the separately trusted recovery computer. No plaintext files are written.
import {readFile} from 'node:fs/promises';
import {createPrivateKey,pbkdf2Sync,createDecipheriv} from 'node:crypto';
import {unseal,digest} from '../envelope.mjs';
export function verifyManagedObject(envelope,privateKey,record,runId){
  if(digest(envelope)!==record.sha256)throw Error('RECEIPT_MISMATCH');
  const key=privateKey?.type==='private'?privateKey.export({type:'pkcs8',format:'pem'}):privateKey;
  const payload=JSON.parse(unseal(envelope,key,{kind:'object',run_id:runId,object_id:record.id}).toString('utf8'));
  const bytes=Buffer.from(payload.bytes,'base64');
  if(payload.source.id!==record.id||payload.source.version!==record.version||bytes.length!==payload.size||digest(bytes)!==payload.sha256)throw Error('RESTORE_INTEGRITY');
  return {id:record.id,size:bytes.length};
}
export async function loadRecoveryKey(path,passphrase){return createPrivateKey({key:await readFile(path),passphrase});}
export async function loadBrowserRecoveryKey(path,passphrase){
  const kit=JSON.parse(await readFile(path,'utf8'));
  if(kit.format!=='Riverbanc-Recovery-Key-v1'||kit.kdf!=='PBKDF2-SHA256'||kit.iterations!==600000)throw Error('INVALID_RECOVERY_KIT');
  const salt=Buffer.from(kit.salt,'base64'),iv=Buffer.from(kit.iv,'base64'),cipher=Buffer.from(kit.ciphertext,'base64');
  if(salt.length!==16||iv.length!==12||cipher.length<32||cipher.length>16384)throw Error('INVALID_RECOVERY_KIT');
  const key=pbkdf2Sync(passphrase,salt,600000,32,'sha256');
  try{const d=createDecipheriv('aes-256-gcm',key,iv);d.setAAD(Buffer.from(kit.format));d.setAuthTag(cipher.subarray(-16));const raw=Buffer.concat([d.update(cipher.subarray(0,-16)),d.final()]);try{return createPrivateKey({key:raw,type:'pkcs8',format:'der'});}finally{raw.fill(0);}}
  finally{key.fill(0);}
}
