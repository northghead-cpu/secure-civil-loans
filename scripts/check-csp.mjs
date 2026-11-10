import fs from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const header=JSON.parse(fs.readFileSync(new URL('../vercel.json',import.meta.url),'utf8')).headers[0].headers.find(h=>h.key==='Content-Security-Policy').value;
assert.ok(!/script-src[^;]*unsafe-inline/.test(header));
assert.ok(!/script-src[^;]*'unsafe-eval'/.test(header));
assert.ok(/script-src[^;]*'wasm-unsafe-eval'/.test(header), 'OCR needs WebAssembly compilation');
assert.ok(!/script-src[^;]*https:/.test(header), 'OCR must not require a script CDN');
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
const staticHeaders=fs.readFileSync(new URL('../public/_headers',import.meta.url),'utf8');
assert.equal(staticHeaders.match(/Content-Security-Policy: ([^\r\n]+)/)?.[1],header,'Hosting policies must match');
assert.equal(fs.readFileSync(new URL('../dist/_headers',import.meta.url),'utf8').match(/Content-Security-Policy: ([^\r\n]+)/)?.[1],header,'Built static-host policy must match');
const dataset=fs.readFileSync(new URL('../dist/ocr/eng-1.0.0/eng.traineddata.gz',import.meta.url));
assert.equal(createHash('sha256').update(dataset).digest('hex'),'45b4cb346724ac1774f1c36f42f182b887bcdb28ebe63e6fff90ac41f3fcff91','Pinned English OCR data changed');
for(const asset of ['tesseract-7.0.0/worker.min.js',...['lstm','simd-lstm','relaxedsimd-lstm'].map(v=>`core-7.0.0/tesseract-core-${v}.wasm.js`)]) {
  assert.ok(fs.statSync(new URL('../dist/ocr/'+asset,import.meta.url)).size>10000,`Missing OCR runtime: ${asset}`);
}
console.log('PASS: pinned same-origin OCR runtime and language data included; hosting CSPs agree');
