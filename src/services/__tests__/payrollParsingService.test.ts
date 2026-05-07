import { describe, it, expect, vi, beforeEach } from "vitest";
import { parsePayslip } from "@/services/payrollParsingService";

// Mock the OCR service so we can inject sample text without real files
vi.mock("@/services/ocrService", () => ({
  processDocument: vi.fn(),
}));

// Keep OCR enabled
vi.mock("@/config/features", () => ({
  features: { enableOCR: true, enableOCROLogging: false, enableFraudDetection: false },
}));

import { processDocument } from "@/services/ocrService";
const mockProcessDocument = vi.mocked(processDocument);

const dummyFile = new File(["x"], "payslip.png", { type: "image/png" });

const makeOCR = (text: string, extra?: Partial<any>) => ({
  success: true,
  extracted_text: text,
  confidence: 85,
  document_type: "payslip" as const,
  full_name: null,
  document_number: null,
  date_of_birth: null,
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Sample payslip texts modelled on real Zambian civil-service payslips ──

const SAMPLE_MOE = `
REPUBLIC OF ZAMBIA
MINISTRY OF EDUCATION

PAY SLIP
Pay Period: March 2026
Employee No: 45892
Name: JOHN MWANSA BANDA

EARNINGS
Basic Salary            K 12,450.00
Housing Allowance       K  2,500.00
Transport Allowance     K    800.00
Total Earnings          K 15,750.00

DEDUCTIONS
PAYE                    K  2,100.00
NAPSA                   K    623.00
NHIMA                   K    157.50
Union Dues              K    120.00
Total Deductions        K  3,000.50

Net Salary              K 12,749.50
`;

const SAMPLE_MOH = `
REPUBLIC OF ZAMBIA
Employer: Ministry of Health

PAYSLIP FOR THE MONTH OF January 2026

Staff No: MH-00234
CHOMBA CHIPETA

Gross Pay:   ZMW 18 200.00
Less Deductions:  ZMW 4 350.00
Net Pay:     ZMW 13 850.00
`;

const SAMPLE_GENERIC = `
Company: Zambia Revenue Authority
Payroll Number: ZRA/7891
Period: December 2025

Gross Salary: 22,000.00
Total Deductions: 5,500.00
Net Amount: 16,500.00
Employee Number: ZRA/7891
`;

const SAMPLE_TAKE_HOME = `
Department: Ministry of Agriculture
Emp No: AG-1122

Basic Salary  K8,900.00
Deductions Total K2,100.00
Take-home Pay K6,800.00

For the month of February 2026
`;

// ── Additional employer formats, amount spacing, period wording ──

const SAMPLE_LOCAL_GOVT = `
REPUBLIC OF ZAMBIA
MINISTRY OF LOCAL GOVERNMENT AND RURAL DEVELOPMENT

PAYSLIP
Pay Period: April 2026
Employee No: LG-30421
Name: MULENGA KABWE

EARNINGS
Basic Salary            K 14,800.00
Rural Hardship Allow.   K  3,200.00
Total Earnings          K 18,000.00

DEDUCTIONS
PAYE                    K  2,800.00
NAPSA                   K    720.00
NHIMA                   K    180.00
Loan Repayment          K  1,500.00
Total Deductions        K  5,200.00

Net Salary              K 12,800.00
`;

const SAMPLE_DEFENCE = `
REPUBLIC OF ZAMBIA
MINISTRY OF DEFENCE & NATIONAL SECURITY

Pay Slip For: May 2026

Staff No: MDS/0088
BWALYA MUSONDA

Gross Income:   K25,500.00
Less Deductions: K6,100.00
Net Pay:        K19,400.00
`;

const SAMPLE_SPACE_SEPARATED = `
Organisation: National Assembly of Zambia
Payroll Number: NA/2045

Salary Period: November 2025

Gross Salary       ZMW 35 000.00
Total Deductions   ZMW 8 750.00
Net Amount         ZMW 26 250.00
`;

const SAMPLE_PERIOD_WORDING_1 = `
Employer: Road Development Agency
Employee Number: RDA-5567

Payslip for the month of October 2025

Basic Salary    K19,000.00
Deductions Total K4,750.00
Amount Payable  K14,250.00
`;

const SAMPLE_PERIOD_WORDING_2 = `
Department: Ministry of Finance
Emp No: MF/7823

Period: July 2025

Gross Pay: 28,400.00
Total Deductions: 7,100.00
Net Payable: 21,300.00
`;

const SAMPLE_NO_CURRENCY_PREFIX = `
Company: ZESCO Limited
Employee ID: ZES-1190

Month: September 2025

Gross Earnings    31500.00
Total Deductions  7875.00
Net Income        23625.00
`;

const SAMPLE_TEACHER = `
REPUBLIC OF ZAMBIA
MINISTRY OF EDUCATION

PAYSLIP - Teaching Service Commission
For the month of August 2026
Employee No: TSC/44210
KALABA MUTALE

Basic Salary            K  9,800.00
Teaching Allowance      K  2,400.00
Housing Allowance       K  1,800.00
Total Earnings          K 14,000.00

PAYE                    K  1,600.00
NAPSA                   K    490.00
NHIMA                   K    140.00
Total Deductions        K  2,230.00

Take-home Pay           K 11,770.00
`;

const SAMPLE_MINIMAL = `
Some random text that doesn't look like a payslip at all.
No amounts, no employer, nothing useful here.
`;

// ─────────────────────────── Tests ───────────────────────────

describe("parsePayslip", () => {
  describe("Ministry of Education payslip", () => {
    it("extracts net salary, deductions, employer, and employee number", async () => {
      mockProcessDocument.mockResolvedValue(makeOCR(SAMPLE_MOE, { full_name: "JOHN MWANSA BANDA" }));
      const r = await parsePayslip(dummyFile);

      expect(r.success).toBe(true);
      expect(r.net_salary).toBe(12749.5);
      expect(r.total_deductions).toBe(3000.5);
      expect(r.gross_salary).toBeCloseTo(15750);
      expect(r.employer).toMatch(/MINISTRY OF EDUCATION/i);
      expect(r.employee_number).toBe("45892");
      expect(r.pay_period).toMatch(/March\s*2026/i);
      expect(r.full_name).toBe("JOHN MWANSA BANDA");
    });
  });

  describe("Ministry of Health payslip (ZMW prefix, space-separated amounts)", () => {
    it("extracts amounts with ZMW prefix and space grouping", async () => {
      mockProcessDocument.mockResolvedValue(makeOCR(SAMPLE_MOH, { full_name: "CHOMBA CHIPETA" }));
      const r = await parsePayslip(dummyFile);

      expect(r.success).toBe(true);
      expect(r.gross_salary).toBe(18200);
      expect(r.total_deductions).toBe(4350);
      expect(r.net_salary).toBe(13850);
      expect(r.employer).toMatch(/Ministry of Health/i);
      expect(r.employee_number).toBe("MH-00234");
      expect(r.pay_period).toMatch(/January\s*2026/i);
    });
  });

  describe("Generic employer payslip (no K/ZMW prefix)", () => {
    it("extracts amounts and payroll number", async () => {
      mockProcessDocument.mockResolvedValue(makeOCR(SAMPLE_GENERIC));
      const r = await parsePayslip(dummyFile);

      expect(r.success).toBe(true);
      expect(r.gross_salary).toBe(22000);
      expect(r.total_deductions).toBe(5500);
      expect(r.net_salary).toBe(16500);
      expect(r.employer).toMatch(/Zambia Revenue Authority/i);
      expect(r.employee_number).toBe("ZRA/7891");
      expect(r.pay_period).toMatch(/December\s*2025/i);
    });
  });

  describe("Take-home keyword and K prefix", () => {
    it("parses take-home as net salary", async () => {
      mockProcessDocument.mockResolvedValue(makeOCR(SAMPLE_TAKE_HOME));
      const r = await parsePayslip(dummyFile);

      expect(r.success).toBe(true);
      expect(r.net_salary).toBe(6800);
      expect(r.gross_salary).toBe(8900);
      expect(r.total_deductions).toBe(2100);
      expect(r.employee_number).toBe("AG-1122");
      expect(r.pay_period).toMatch(/February\s*2026/i);
    });
  });

  describe("Ministry of Local Government (long ministry name)", () => {
    it("extracts employer with multi-word ministry name", async () => {
      mockProcessDocument.mockResolvedValue(makeOCR(SAMPLE_LOCAL_GOVT, { full_name: "MULENGA KABWE" }));
      const r = await parsePayslip(dummyFile);

      expect(r.success).toBe(true);
      expect(r.net_salary).toBe(12800);
      expect(r.total_deductions).toBe(5200);
      expect(r.gross_salary).toBeCloseTo(18000);
      expect(r.employer).toMatch(/MINISTRY OF LOCAL GOVERNMENT/i);
      expect(r.employee_number).toBe("LG-30421");
      expect(r.pay_period).toMatch(/April\s*2026/i);
    });
  });

  describe("Ministry of Defence with ampersand", () => {
    it("extracts employer containing & symbol", async () => {
      mockProcessDocument.mockResolvedValue(makeOCR(SAMPLE_DEFENCE));
      const r = await parsePayslip(dummyFile);

      expect(r.success).toBe(true);
      expect(r.net_salary).toBe(19400);
      expect(r.total_deductions).toBe(6100);
      expect(r.gross_salary).toBe(25500);
      expect(r.employer).toMatch(/MINISTRY OF DEFENCE/i);
      expect(r.employee_number).toBe("MDS/0088");
      expect(r.pay_period).toMatch(/May\s*2026/i);
    });
  });

  describe("Space-separated ZMW amounts (National Assembly)", () => {
    it("parses ZMW amounts with space thousands separator", async () => {
      mockProcessDocument.mockResolvedValue(makeOCR(SAMPLE_SPACE_SEPARATED));
      const r = await parsePayslip(dummyFile);

      expect(r.success).toBe(true);
      expect(r.gross_salary).toBe(35000);
      expect(r.total_deductions).toBe(8750);
      expect(r.net_salary).toBe(26250);
      expect(r.employer).toMatch(/National Assembly of Zambia/i);
      expect(r.employee_number).toBe("NA/2045");
      expect(r.pay_period).toMatch(/November\s*2025/i);
    });
  });

  describe("'for the month of' pay-period wording + Amount Payable", () => {
    it("extracts period from 'for the month of' and net from 'Amount Payable'", async () => {
      mockProcessDocument.mockResolvedValue(makeOCR(SAMPLE_PERIOD_WORDING_1));
      const r = await parsePayslip(dummyFile);

      expect(r.success).toBe(true);
      expect(r.gross_salary).toBe(19000);
      expect(r.total_deductions).toBe(4750);
      expect(r.net_salary).toBe(14250);
      expect(r.employer).toMatch(/Road Development Agency/i);
      expect(r.employee_number).toBe("RDA-5567");
      expect(r.pay_period).toMatch(/October\s*2025/i);
    });
  });

  describe("'Period:' wording + Net Payable keyword", () => {
    it("parses 'Net Payable' and 'Period:' format", async () => {
      mockProcessDocument.mockResolvedValue(makeOCR(SAMPLE_PERIOD_WORDING_2));
      const r = await parsePayslip(dummyFile);

      expect(r.success).toBe(true);
      expect(r.gross_salary).toBe(28400);
      expect(r.total_deductions).toBe(7100);
      expect(r.net_salary).toBe(21300);
      expect(r.employer).toMatch(/Ministry of Finance/i);
      expect(r.employee_number).toBe("MF/7823");
      expect(r.pay_period).toMatch(/July\s*2025/i);
    });
  });

  describe("No currency prefix (plain numbers)", () => {
    it("extracts amounts without K or ZMW prefix", async () => {
      mockProcessDocument.mockResolvedValue(makeOCR(SAMPLE_NO_CURRENCY_PREFIX));
      const r = await parsePayslip(dummyFile);

      expect(r.success).toBe(true);
      expect(r.gross_salary).toBe(31500);
      expect(r.total_deductions).toBe(7875);
      expect(r.net_salary).toBe(23625);
      expect(r.employer).toMatch(/ZESCO Limited/i);
      expect(r.employee_number).toBe("ZES-1190");
    });
  });

  describe("Teacher payslip with Take-home Pay and TSC number", () => {
    it("extracts take-home pay and Teaching Service Commission details", async () => {
      mockProcessDocument.mockResolvedValue(makeOCR(SAMPLE_TEACHER, { full_name: "KALABA MUTALE" }));
      const r = await parsePayslip(dummyFile);

      expect(r.success).toBe(true);
      expect(r.net_salary).toBe(11770);
      expect(r.total_deductions).toBe(2230);
      expect(r.gross_salary).toBeCloseTo(14000);
      expect(r.employer).toMatch(/MINISTRY OF EDUCATION/i);
      expect(r.employee_number).toBe("TSC/44210");
      expect(r.pay_period).toMatch(/August\s*2026/i);
    });
  });

  describe("Minimal / non-payslip text", () => {
    it("returns success true but null amounts", async () => {
      mockProcessDocument.mockResolvedValue(makeOCR(SAMPLE_MINIMAL));
      const r = await parsePayslip(dummyFile);

      expect(r.success).toBe(true);
      expect(r.net_salary).toBeNull();
      expect(r.gross_salary).toBeNull();
      expect(r.total_deductions).toBeNull();
      expect(r.employer).toBeNull();
      expect(r.employee_number).toBeNull();
    });
  });

  describe("OCR failure", () => {
    it("returns success false when OCR fails", async () => {
      mockProcessDocument.mockResolvedValue({
        success: false,
        extracted_text: "",
        confidence: 0,
        document_type: "payslip",
        full_name: null,
        document_number: null,
        date_of_birth: null,
        error: "OCR engine error",
      });
      const r = await parsePayslip(dummyFile);

      expect(r.success).toBe(false);
      expect(r.error).toBe("OCR engine error");
    });
  });

  describe("OCR disabled", () => {
    it("returns success false when OCR feature flag is off", async () => {
      // Temporarily override features
      const featMod = await import("@/config/features");
      const orig = (featMod.features as any).enableOCR;
      (featMod.features as any).enableOCR = false;

      const r = await parsePayslip(dummyFile);
      expect(r.success).toBe(false);
      expect(r.error).toBe("OCR is disabled");

      (featMod.features as any).enableOCR = orig;
    });
  });

  describe("Employee number fallback to OCR document_number", () => {
    it("uses OCR document_number when no employee number pattern found", async () => {
      const text = "Net Salary: 10000\nNo employee info here.";
      mockProcessDocument.mockResolvedValue(makeOCR(text, { document_number: "FALLBACK-999" }));
      const r = await parsePayslip(dummyFile);

      expect(r.success).toBe(true);
      expect(r.employee_number).toBe("FALLBACK-999");
    });
  });
});
