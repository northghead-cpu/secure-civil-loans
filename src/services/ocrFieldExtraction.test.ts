import { describe, it, expect } from "vitest";
import { extractDocumentName, extractDocumentEmployer } from "./ocrFieldExtraction";

describe("OCR field boundaries", () => {
  it("keeps identity names separate from the next line and inline fields", () => {
    expect(extractDocumentName("Full Name: Alice Banda\nNRC Number: 123456/78/1")).toBe("Alice Banda");
    expect(extractDocumentName("Full Name: Alice Banda   NRC Number: 123456/78/1")).toBe("Alice Banda");
  });
  it("supports next-line labeled names, accented names, and passport name parts", () => {
    expect(extractDocumentName("Full Name:\nChloé O’Banda\nDate of Birth: 01/01/1990")).toBe("Chloé O’Banda");
    expect(extractDocumentName("Surname: PHIRI\nGiven Names: GRACE MUTALE\nPassport No: ZZ1234567")).toBe("GRACE MUTALE PHIRI");
  });
  it("does not substitute headings or the next field for a missing name", () => {
    expect(extractDocumentName("SYNTHETIC TEST ONLY\nNOT VALID IDENTIFICATION\nPASSPORT\nFull Name:\nNRC Number: 123456/78/1")).toBeNull();
    expect(extractDocumentName("SYNTHETIC PAYSLIP\nMINISTRY OF EDUCATION\nPAY SLIP\nEARNINGS\nDEDUCTIONS")).toBeNull();
  });
  it("preserves conservative unlabelled uppercase card names", () => {
    expect(extractDocumentName("REPUBLIC OF ZAMBIA\nNATIONAL REGISTRATION CARD\nCHOMBA JAMES MWANSA\nNRC No: 456789/12/1")).toBe("CHOMBA JAMES MWANSA");
  });
  it("bounds both labeled and ministry employers to a single field", () => {
    expect(extractDocumentEmployer("Employer: Synthetic Ministry\nEmployee Number: TEST-ONLY")).toBe("Synthetic Ministry");
    expect(extractDocumentEmployer("Employer: Synthetic Ministry   Employee Number: TEST-ONLY")).toBe("Synthetic Ministry");
    expect(extractDocumentEmployer("Employer: Synthetic Ministry   Employee Number TEST-ONLY")).toBe("Synthetic Ministry");
    expect(extractDocumentEmployer("MINISTRY OF LOCAL GOVERNMENT AND RURAL DEVELOPMENT\nPAYSLIP\nPay Period: October 2026")).toBe("MINISTRY OF LOCAL GOVERNMENT AND RURAL DEVELOPMENT");
    expect(extractDocumentEmployer("Employer:\nEmployee Number: TEST-ONLY")).toBeNull();
  });
});
