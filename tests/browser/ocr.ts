import { parseNRC, parseGovernmentID } from "../../src/services/idDocumentParsingService";
import { parsePayslip } from "../../src/services/payrollParsingService";

const file = document.querySelector<HTMLInputElement>("#file")!;
const kind = document.querySelector<HTMLSelectElement>("#kind")!;
const result = document.querySelector<HTMLElement>("#result")!;
let violations = 0;
document.addEventListener("securitypolicyviolation", () => {
  document.querySelector("#violations")!.textContent = `Security policy violations: ${++violations}`;
});
file.addEventListener("change", async () => {
  if (!file.files?.[0]) return;
  result.textContent = "Processing…";
  const parsed = kind.value === "payslip" ? await parsePayslip(file.files[0])
    : kind.value === "passport" ? await parseGovernmentID(file.files[0], "passport")
      : await parseNRC(file.files[0]);
  // Synthetic inputs only. Omit raw OCR text from the test evidence.
  const { raw_text: _raw, ...summary } = parsed;
  result.textContent = JSON.stringify(summary, null, 2);
});
