import fs from 'node:fs';
import { createHash } from 'node:crypto';
const html = fs.readFileSync(new URL('../index.html',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const hashes = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
 .filter(([,attrs,body])=>!attrs.includes('src=')&&body.trim())
 .map(([, ,body])=>`'sha256-${createHash('sha256').update(body).digest('base64')}'`);
const path=new URL('../vercel.json',import.meta.url);
const config=JSON.parse(fs.readFileSync(path,'utf8'));
const header=config.headers[0].headers.find(h=>h.key==='Content-Security-Policy');
const sentryOrigin=process.env.VITE_SENTRY_ORIGIN??header.value.match(/https:\/\/o\d+\.ingest(?:\.de)?\.sentry\.io/)?.[0];
if(!sentryOrigin||!/^https:\/\/o\d+\.ingest(?:\.de)?\.sentry\.io$/.test(sentryOrigin))throw new Error('Set VITE_SENTRY_ORIGIN to the reviewed project ingestion origin');
header.value=header.value.replace(/script-src [^;]+/,`script-src 'self' ${hashes.join(' ')}`)
 .replace(/img-src [^;]+/,"img-src 'self' data: blob: https://zdpeaxkormwjrgllwalq.supabase.co https://mioppvtzbaixeeuxkroo.supabase.co")
 .replace(/style-src [^;]+/,"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com")
 .replace(/font-src [^;]+/,"font-src 'self' data: https://fonts.gstatic.com")
 .replace('https://*.supabase.co wss://*.supabase.co','https://zdpeaxkormwjrgllwalq.supabase.co wss://zdpeaxkormwjrgllwalq.supabase.co https://mioppvtzbaixeeuxkroo.supabase.co wss://mioppvtzbaixeeuxkroo.supabase.co')
 .replace(/https:\/\/(?:\*|o\d+)\.ingest(?:\.de)?\.sentry\.io/g,sentryOrigin)
 .replace(`${sentryOrigin} ${sentryOrigin}`,sentryOrigin);
fs.writeFileSync(path,JSON.stringify(config,null,2)+'\n');
