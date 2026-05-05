import { describe, it, expect } from "vitest";
import { execSync } from "child_process";

describe("Brand name check", () => {
  it('should not contain the old name "Riverbank" anywhere in source files', () => {
    let output = "";
    try {
      output = execSync(
        `grep -rl "Riverbank" --include="*.tsx" --include="*.ts" --include="*.html" --include="*.json" --include="*.jsx" --include="*.css" --include="*.md" . || true`,
        { cwd: process.cwd(), encoding: "utf-8" }
      ).trim();
    } catch {
      // grep returns exit 1 when no matches — that's the success case
    }

    // Filter out this test file itself and node_modules
    const offending = output
      .split("\n")
      .filter((f) => f && !f.includes("node_modules") && !f.includes("no-old-name.test.ts"))
      .filter(Boolean);

    expect(offending, `These files still reference "Riverbank":\n${offending.join("\n")}`).toHaveLength(0);
  });
});
