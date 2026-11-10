import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("@/services/ocrService", () => ({
  processDocument: vi.fn(),
}));

vi.mock("@/config/features", () => ({
  features: { enableOCR: true, enableOCROLogging: false },
}));

import { parseNRC, parseGovernmentID } from "../idDocumentParsingService";
import { processDocument } from "@/services/ocrService";
import { features } from "@/config/features";

const mockFile = new File(["dummy"], "test.jpg", { type: "image/jpeg" });

const mockOCR = (text: string, extra: Partial<any> = {}) => {
  (processDocument as any).mockResolvedValue({
    success: true,
    extracted_text: text,
    confidence: 88,
    full_name: null,
    document_number: null,
    date_of_birth: null,
    document_type: "nrc",
    ...extra,
  });
};

describe("parseNRC", () => {
  beforeEach(() => vi.clearAllMocks());

  it("extracts NRC number, name, DOB, and gender", async () => {
    mockOCR(`REPUBLIC OF ZAMBIA
NATIONAL REGISTRATION CARD
CHOMBA JAMES MWANSA
NRC No: 456789/12/1
Date of Birth: 15/06/1985
Sex: Male
District: Lusaka`);

    const r = await parseNRC(mockFile);
    expect(r.success).toBe(true);
    expect(r.document_number).toBe("456789/12/1");
    expect(r.full_name).toBe("CHOMBA JAMES MWANSA");
    expect(r.date_of_birth).toBe("15/06/1985");
    expect(r.gender).toBe("Male");
    expect(r.nationality).toBe("Zambian");
  });

  it("returns success false when OCR is disabled", async () => {
    (features as any).enableOCR = false;
    const r = await parseNRC(mockFile);
    expect(r.success).toBe(false);
    expect(r.error).toBe("OCR is disabled");
    (features as any).enableOCR = true;
  });

  it("handles OCR failure gracefully", async () => {
    (processDocument as any).mockResolvedValue({
      success: false,
      extracted_text: "",
      confidence: 0,
      full_name: null,
      document_number: null,
      date_of_birth: null,
      document_type: "nrc",
      error: "OCR engine error",
    });
    const r = await parseNRC(mockFile);
    expect(r.success).toBe(false);
    expect(r.error).toBe("OCR engine error");
  });

  it("handles NRC with spaces in number", async () => {
    mockOCR(`REPUBLIC OF ZAMBIA
JOHN BANDA
123456 / 78 / 1
D.O.B: 01/01/1990`);

    const r = await parseNRC(mockFile);
    expect(r.success).toBe(true);
    expect(r.document_number).toBe("123456/78/1");
    expect(r.date_of_birth).toBe("01/01/1990");
  });
});

describe("parseGovernmentID — passport", () => {
  beforeEach(() => vi.clearAllMocks());

  it("extracts passport number, name, expiry, and nationality", async () => {
    mockOCR(`REPUBLIC OF ZAMBIA
PASSPORT
Surname: PHIRI
Given Names: GRACE MUTALE
Passport No: ZN1234567
Date of Birth: 22/03/1992
Date of Expiry: 22/03/2032
Nationality: Zambian
Sex: Female`, { document_type: "government_id" });

    const r = await parseGovernmentID(mockFile, "passport");
    expect(r.success).toBe(true);
    expect(r.document_number).toBe("ZN1234567");
    expect(r.expiry_date).toBe("22/03/2032");
    expect(r.date_of_birth).toBe("22/03/1992");
    expect(r.gender).toBe("Female");
    expect(r.nationality).toBe("Zambian");
  });
});

describe("parseGovernmentID — driving license", () => {
  beforeEach(() => vi.clearAllMocks());

  it("extracts licence number and expiry", async () => {
    mockOCR(`ROAD TRANSPORT AND SAFETY AGENCY
ZAMBIA
DRIVING LICENCE
Licence No: DL-789012
MUSONDA PETER CHANDA
Valid Until: 30/11/2028
D.O.B: 05/08/1988
Gender: M`, { document_type: "government_id" });

    const r = await parseGovernmentID(mockFile, "driving_license");
    expect(r.success).toBe(true);
    expect(r.document_number).toBe("DL-789012");
    expect(r.expiry_date).toBe("30/11/2028");
    expect(r.full_name).toBe("MUSONDA PETER CHANDA");
    expect(r.gender).toBe("Male");
  });
});

describe("parseGovernmentID — employee ID", () => {
  beforeEach(() => vi.clearAllMocks());

  it("extracts employee ID number", async () => {
    mockOCR(`GOVERNMENT OF THE REPUBLIC OF ZAMBIA
MINISTRY OF EDUCATION
Employee ID: MOE-45678
KABWE ANNA LUNGU
Designation: Senior Teacher`, { document_type: "government_id" });

    const r = await parseGovernmentID(mockFile, "employee_id");
    expect(r.success).toBe(true);
    expect(r.document_number).toBe("MOE-45678");
    expect(r.full_name).toBe("KABWE ANNA LUNGU");
  });
});

describe("parseGovernmentID — minimal text", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns success true but null fields for non-ID content", async () => {
    mockOCR("Some random text with no ID data");
    const r = await parseGovernmentID(mockFile);
    expect(r.success).toBe(true);
    expect(r.document_number).toBeNull();
    expect(r.full_name).toBeNull();
    expect(r.expiry_date).toBeNull();
  });
});
