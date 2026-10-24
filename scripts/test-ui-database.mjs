// PostgreSQL unit fixture, not a substitute for a Supabase staging migration run.
// No credentials, external connections, customer data, or production writes.
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs/promises";
const db = new PGlite();
try {
  await db.exec(
    await fs.readFile(
      new URL("../supabase/tests/fixtures/ui_bootstrap.sql", import.meta.url),
      "utf8",
    ),
  );
  console.log("PASS: isolated PostgreSQL schema fixture loaded");
  await db.exec(
    await fs.readFile(
      new URL(
        "../supabase/migrations/20261022205917_marketplace_ui_workflows.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  console.log(
    "PASS: complete workflow migration applied in isolated PostgreSQL",
  );
  const results = await db.exec(
    await fs.readFile(
      new URL("../supabase/tests/security/ui_workflows.sql", import.meta.url),
      "utf8",
    ),
  );
  for (const result of results)
    for (const row of result.rows ?? [])
      if (typeof row.result === "string" && row.result.startsWith("PASS:"))
        console.log(row.result);
  await db.exec(await fs.readFile(new URL("../supabase/migrations/20261024064302_cloudflare_audit_remediation.sql", import.meta.url), "utf8"));
  console.log("PASS: audit remediation migration applied");
  const securityResults = await db.exec(await fs.readFile(new URL("../supabase/tests/security/audit_remediation.sql", import.meta.url), "utf8"));
  for (const result of securityResults) for (const row of result.rows ?? []) if (typeof row.result === "string") console.log(row.result);
} catch (error) {
  console.error("Database regression failed:", error.message, error.internalQuery ?? "", error.where ?? "");
  process.exitCode = 1;
} finally {
  await db.close();
}
