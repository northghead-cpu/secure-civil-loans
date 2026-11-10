import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
export function inspectHistory(names, recorded = []) {
  const errors = [],
    seen = new Set(),
    versions = [];
  for (const name of [...names].sort()) {
    const match = /^(\d{14})_[a-zA-Z0-9_-]+\.sql$/.exec(name);
    if (!match) {
      errors.push(`Invalid migration filename: ${name}`);
      continue;
    }
    const version = match[1];
    if (seen.has(version))
      errors.push(`Duplicate migration version: ${version}`);
    seen.add(version);
    versions.push(version);
  }
  for (const row of recorded)
    if (!seen.has(row.version))
      errors.push(`Recorded migration missing locally: ${row.version}`);
  const recordedSet = new Set(recorded.map((x) => x.version));
  const unrecorded = versions.filter((x) => !recordedSet.has(x));
  const latest = [...recordedSet].sort().at(-1);
  for (const version of unrecorded)
    if (latest && version < latest)
      errors.push(
        `Unrecorded historical migration would replay out of order: ${version}`,
      );
  return { errors, versions, unrecorded };
}
export async function checkRepository(root = new URL("../", import.meta.url)) {
  const directory = new URL("supabase/migrations/", root),
    fixture = JSON.parse(
      await readFile(
        new URL(
          "supabase/tests/fixtures/migration-history-production.json",
          root,
        ),
        "utf8",
      ),
    );
  const result = inspectHistory(await readdir(directory), fixture.history);
  const manifest = JSON.parse(
    await readFile(new URL(fixture.reconciliation_manifest, root), "utf8"),
  );
  const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
  for (const item of manifest.canonical) {
    const bytes = await readFile(new URL(item.path, directory));
    if (sha(bytes) !== item.sha256)
      result.errors.push(`Recorded SQL changed: ${item.path}`);
  }
  for (const item of manifest.archived) {
    const bytes = await readFile(
      new URL(manifest.archive_root + "/" + item.path, root),
    );
    if (sha(bytes) !== item.sha256)
      result.errors.push(`Archived source changed: ${item.path}`);
  }
  if (manifest.canonical.length !== fixture.history.length)
    result.errors.push("Recorded manifest coverage mismatch");
  const archiveNames = await readdir(
    new URL(manifest.archive_root + "/", root),
  );
  if (archiveNames.length !== manifest.archived.length)
    result.errors.push("Archive inventory mismatch");
  if (result.errors.length) throw Error(result.errors.join("\n"));
  console.log(
    `PASS: ${result.versions.length} uniquely versioned, 14-digit migration filenames cover ${fixture.history.length} observed production records; recorded SQL and all archived source bytes are preserved`,
  );
  console.log(
    `INFO: ${result.unrecorded.length} new versions after the observed production ledger; no historical SQL is replayed or marked applied by this check`,
  );
  return result;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await checkRepository();
