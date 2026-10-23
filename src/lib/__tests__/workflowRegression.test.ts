import { describe, expect, it, vi } from "vitest";
import { readAllRows } from "../readAllRows";
import { handoffProgress } from "../handoffProgress";
import { safeReturnPath } from "../safeReturnPath";
describe("complete export and list reads", () => {
  it("continues beyond a full page, including an exact multiple", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ data: [1, 2], error: null })
      .mockResolvedValueOnce({ data: [3, 4], error: null })
      .mockResolvedValueOnce({ data: [], error: null });
    expect(await readAllRows(fetch, 2)).toEqual([1, 2, 3, 4]);
    expect(fetch.mock.calls).toEqual([
      [0, 1],
      [2, 3],
      [4, 5],
    ]);
  });
  it("does not return a partial export when a later page fails", async () => {
    const failure = new Error("denied");
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ data: [1, 2], error: null })
      .mockResolvedValueOnce({ data: null, error: failure });
    await expect(readAllRows(fetch, 2)).rejects.toBe(failure);
  });
  it("distinguishes empty success from missing/error data", async () => {
    expect(await readAllRows(async () => ({ data: [], error: null }))).toEqual(
      [],
    );
    await expect(
      readAllRows(async () => ({ data: null, error: null })),
    ).rejects.toThrow("No data");
  });
});
describe("handoff journey", () => {
  it.each(["authorized", "preparing"])(
    "records selection and authorization complete at %s",
    (status) => {
      expect(handoffProgress(status)).toEqual({ completed: 2, current: 2 });
    },
  );
  it.each([
    "sent_to_lender",
    "lender_review",
    "additional_information_requested",
  ])("keeps review current at %s", (status) => {
    expect(handoffProgress(status)).toEqual({ completed: 3, current: 3 });
  });
  it.each(["approved", "declined", "disbursed"])(
    "completes the journey after institution outcome %s",
    (status) => {
      expect(handoffProgress(status)).toEqual({ completed: 5, current: null });
    },
  );
});
describe("authentication task resumption", () => {
  it("preserves an internal path with query and hash", () =>
    expect(safeReturnPath("/application-status?id=abc#details")).toBe(
      "/application-status?id=abc#details",
    ));
  it.each([
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/login",
    "/reset-password",
    "/forgot-password",
    "/apply\n",
    "javascript:alert(1)",
  ])("rejects unsafe or looping return %s", (path) =>
    expect(safeReturnPath(path)).toBeNull(),
  );
});
