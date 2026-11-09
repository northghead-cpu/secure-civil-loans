import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { openPrivateStorageDocument } from "./privateStorageDocuments";
const mocks = vi.hoisted(() => ({ download: vi.fn(), from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { storage: { from: mocks.from } } }));
let popup: { opener: unknown; document: { body: { textContent: string } }; location: { href: string }; close: ReturnType<typeof vi.fn>; closed: boolean };
beforeEach(() => {
  vi.useFakeTimers();
  mocks.download.mockReset();
  mocks.from.mockReset().mockReturnValue({ download: mocks.download });
  mocks.download.mockResolvedValue({ data: new Blob(["synthetic"], { type: "application/pdf" }), error: null });
  popup = { opener: {}, document: { body: { textContent: "" } }, location: { href: "" }, close: vi.fn(), closed: false };
  vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn().mockReturnValue("blob:local-only") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
it("fetches with the session-bound Storage API and displays a temporary local URL", async () => {
  await openPrivateStorageDocument("kyc-documents", "owner/file.pdf");
  expect(mocks.from).toHaveBeenCalledWith("kyc-documents");
  expect(mocks.download).toHaveBeenCalledWith("owner/file.pdf");
  expect(popup.opener).toBeNull();
  expect(popup.location.href).toBe("blob:local-only");
  await vi.advanceTimersByTimeAsync(60_000);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:local-only");
});
it("does not read a document when pop-ups are blocked", async () => {
  vi.mocked(window.open).mockReturnValue(null);
  await expect(openPrivateStorageDocument("kyc-documents", "owner/file.pdf")).rejects.toThrow("pop-ups");
  expect(mocks.download).not.toHaveBeenCalled();
});
it("closes the blank window and exposes no URL when storage denies access", async () => {
  mocks.download.mockResolvedValue({data:null,error:{message:"denied"}});
  await expect(openPrivateStorageDocument("kyc-documents", "other/file.pdf")).rejects.toThrow("unavailable");
  expect(popup.close).toHaveBeenCalled();expect(URL.createObjectURL).not.toHaveBeenCalled();
});
it.each(["text/html", "image/svg+xml", "application/javascript"])("refuses active content with MIME %s", async (type) => {
  mocks.download.mockResolvedValue({data:new Blob(["synthetic"],{type}),error:null});
  await expect(openPrivateStorageDocument("kyc-documents", "owner/file")).rejects.toThrow("unavailable");
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});
it("does not create a URL if the viewer was closed during the fetch", async () => {
  popup.closed=true;
  await openPrivateStorageDocument("kyc-documents", "owner/file.pdf");
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});
it("downloads receipts without opening a signed remote URL", async () => {
  const click=vi.spyOn(HTMLAnchorElement.prototype,"click").mockImplementation(() => {});
  await openPrivateStorageDocument("payment-receipts", "owner/receipt.pdf", "download", "receipt.pdf");
  expect(window.open).not.toHaveBeenCalled();expect(click).toHaveBeenCalledOnce();
  expect(document.querySelector("a")).toBeNull();
});
