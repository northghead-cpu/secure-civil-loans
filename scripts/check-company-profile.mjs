import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

// Run against a preview before release, then against production after deployment.
const base = process.argv[2];
assert.ok(base, 'Usage: node scripts/check-company-profile.mjs https://deployment-host');
const source = await readFile(new URL('../public/partnership-profile/riverbanc-company-profile.pdf', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
for (const path of [
  '/partnership-profile',
  '/partnership-profile/',
  '/partnership-profile/index.html',
  '/partnership-profile/riverbanc-company-profile.pdf',
  '/partnership-profile/?source=qr',
]) {
  const url = new URL(path, base);
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(30_000) });
  assert.equal(response.status, 200, `${path}: must serve the PDF directly`);
  assert.match(response.headers.get('content-type') ?? '', /^application\/pdf\b/i, path);
  assert.match(response.headers.get('content-disposition') ?? '', /^inline;/i, path);
  assert.match(response.headers.get('cache-control') ?? '', /must-revalidate/i, path);
  assert.match(response.headers.get('x-robots-tag') ?? '', /noindex/i, path);
  assert.equal(hash(Buffer.from(await response.arrayBuffer())), hash(source), `${path}: PDF differs from approved file`);
  const head = await fetch(url, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(30_000) });
  assert.equal(head.status, 200, `${path}: HEAD failed`);
  assert.match(head.headers.get('content-type') ?? '', /^application\/pdf\b/i, path);
  console.log(`PASS ${path}: approved PDF bytes and inline headers`);
}
for (const path of ['/', '/compare', '/login']) {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(30_000) });
  assert.equal(response.status, 200, path);
  assert.match(response.headers.get('content-type') ?? '', /^text\/html\b/i, `${path}: marketplace must remain HTML`);
  console.log(`PASS ${path}: marketplace HTML`);
}
