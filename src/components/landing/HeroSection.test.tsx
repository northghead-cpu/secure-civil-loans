import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

describe("Riverbanc homepage hero claims", () => {
  it("does not contain unsupported certification, scale, savings, or absolute-security claims", () => {
    const filePath = fileURLToPath(new URL("./HeroSection.tsx", import.meta.url));
    const source = readFileSync(path.resolve(filePath), "utf8");

    expect(source).not.toContain("300K+");
    expect(source).not.toContain("3.5%");
    expect(source).not.toContain("100%");
    expect(source).not.toContain("The only platform");
    expect(source).not.toContain("Trusted by over 300,000");
  });
});
