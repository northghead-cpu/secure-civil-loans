import process from "node:process";
import { readFile, stat } from "node:fs/promises";
import { sourceFromEnv, destinationFromEnv, clamScanner } from "./adapters.mjs";
import { runBackup, verifyRestore } from "./worker.mjs";
async function main() {
  const mode = process.argv[2];
  if (!["backup", "verify-restore"].includes(mode))
    throw Error("MODE_REQUIRED");
  const destination = await destinationFromEnv();
  if (mode === "backup") {
    if (!process.env.KYC_BACKUP_PUBLIC_KEY_FILE)
      throw Error("RECOVERY_PUBLIC_KEY_FILE_REQUIRED");
    const publicKey = await readFile(
      process.env.KYC_BACKUP_PUBLIC_KEY_FILE,
      "utf8",
    );
    const result = await runBackup({
      source: sourceFromEnv(),
      destination,
      scanner: clamScanner(),
      publicKey,
    });
    console.log(JSON.stringify(result)); // Opaque receipt only; no borrower paths.
    if (result.errors || result.infected) process.exitCode = 2;
  } else {
    const path = process.env.KYC_RECOVERY_PRIVATE_KEY_FILE;
    if (!path || ((await stat(path)).mode & 0o077) !== 0)
      throw Error("PROTECTED_RECOVERY_KEY_FILE_REQUIRED");
    const privateKey = {
      key: await readFile(path, "utf8"),
      passphrase: process.env.KYC_RECOVERY_KEY_PASSPHRASE,
    };
    const result = await verifyRestore({
      destination,
      privateKey,
      runId: process.env.KYC_BACKUP_RUN_ID,
      manifestSha256: process.env.KYC_BACKUP_MANIFEST_SHA256,
    });
    console.log(JSON.stringify(result));
  }
}
main().catch(() => {
  console.error(
    JSON.stringify({
      status: "failed",
      message:
        "Storage security operation failed. Check protected configuration, scanner health and backup permissions; no success is recorded.",
    }),
  );
  process.exitCode = 1;
});
