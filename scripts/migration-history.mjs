import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
export function inspectHistory(names, recorded = []) {
 const errors=[],seen=new Set(),versions=[];
 for(const name of [...names].sort()){
  const match=/^(\d{14})_[a-zA-Z0-9_-]+\.sql$/.exec(name);
  if(!match){errors.push(`Invalid migration filename: ${name}`);continue;}
  const version=match[1];if(seen.has(version))errors.push(`Duplicate migration version: ${version}`);seen.add(version);versions.push(version);
 }
 for(const row of recorded)if(!seen.has(row.version))errors.push(`Recorded migration missing locally: ${row.version}`);
 const recordedSet=new Set(recorded.map(x=>x.version));
 return {errors,versions,unrecorded:versions.filter(x=>!recordedSet.has(x))};
}
export async function checkRepository(root=new URL('../',import.meta.url)){
 const directory=new URL('supabase/migrations/',root),fixture=JSON.parse(await readFile(new URL('supabase/tests/fixtures/migration-history-production.json',root),'utf8'));
 const result=inspectHistory(await readdir(directory),fixture.history);
 for(const item of fixture.canonicalized_sources){
  const bytes=await readFile(new URL(item.canonical_path,directory));
  if(createHash('sha256').update(bytes).digest('hex')!==item.sha256)result.errors.push(`Canonicalized SQL changed: ${item.canonical_path}`);
 }
 if(result.errors.length)throw Error(result.errors.join('\n'));
 console.log(`PASS: ${result.versions.length} uniquely versioned, 14-digit migration filenames cover ${fixture.history.length} observed production records; canonicalized SQL bytes are preserved`);
 console.log(`INFO: ${result.unrecorded.length} repository versions are absent from the observed production ledger; no migration is marked applied or executed by this check`);
 return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url))await checkRepository();
