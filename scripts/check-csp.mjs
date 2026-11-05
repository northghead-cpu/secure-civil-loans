import fs from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const header=JSON.parse(fs.readFileSync(new URL('../vercel.json',import.meta.url),'utf8')).headers[0].headers.find(h=>h.key==='Content-Security-Policy').value;
assert.ok(!/script-src[^;]*unsafe-inline/.test(header));
assert.ok(!header.includes('https://*.supabase.co'));
assert.ok(!header.includes('*.ingest'));
assert.ok(!/img-src[^;]* https:;/.test(header));
for(const file of ['index.html','dist/index.html']){
 const html=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8').replace(/\r\n/g,'\n');
 for(const [,attrs,body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
  if(attrs.includes('src=')||!body.trim())continue;
  const hash=createHash('sha256').update(body).digest('base64');
  assert.ok(header.includes(`'sha256-${hash}'`),`CSP hash missing for ${file}`);
 }
}
console.log('PASS: inline script hashes match source and build; arbitrary inline scripts and wildcard Supabase/image hosts are excluded');
