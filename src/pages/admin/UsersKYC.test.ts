import { describe, expect, it } from "vitest";
import { maskNrc } from "./UsersKYC";

describe("KYC sensitive-data presentation", () => {
  it("masks NRC values by default while retaining only the final four characters", () => {
    expect(maskNrc("123456/78/9")).toBe("•••••••78/9");
  });

  it("does not expose short NRC values", () => {
    expect(maskNrc("1234")).toBe("••••");
    expect(maskNrc(null)).toBe("—");
  });
});
