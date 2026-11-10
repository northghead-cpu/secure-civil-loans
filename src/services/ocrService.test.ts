import { describe, it, expect, vi } from "vitest";
vi.mock("tesseract.js", () => ({ default: { recognize: vi.fn() } }));
import Tesseract from "tesseract.js";
import { isValidFileType, processDocument } from "./ocrService";

describe("OCR input formats", () => {
  it("rejects PDFs before starting image OCR and explains conversion", async () => {
    const result = await processDocument(new File(["%PDF-1.7"], "identity.pdf", { type: "application/pdf" }));
    expect(result.success).toBe(false);
    expect(result.error).toContain("Convert PDF pages to images");
    expect(Tesseract.recognize).not.toHaveBeenCalled();
  });
  it("accepts JPEG and PNG images but excludes PDF and SVG", () => {
    for (const type of ["image/jpeg", "image/png"]) expect(isValidFileType(new File([], "document", { type }))).toBe(true);
    for (const type of ["application/pdf", "image/svg+xml"]) expect(isValidFileType(new File([], "document", { type }))).toBe(false);
  });
});
