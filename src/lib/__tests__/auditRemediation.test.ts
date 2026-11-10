import { describe, it, expect } from "vitest";
import { csvCell, toCsvRows } from "../csv";
import { receiptDisplayText, runReceiptBatch } from "../../../supabase/functions/process-monthly-payroll-receipts/safety";
import { aikidoEventKey } from "../../../supabase/functions/_shared/aikido-event-key";
describe("audit security regressions", () => {
 it("exports hostile spreadsheet text as literal quoted cells", () => {
  for (const text of ["=1+1", "+1", "-1", "@SUM(1)", " \t=1", "\tplain"]) expect(csvCell(text)).toMatch(/^"'/);
  expect(csvCell('a"b,c')).toBe('"a""b,c"');
  expect(toCsvRows([["name", "value"], ['a"b', "=1+1"]])).toBe('"name","value"\r\n"a""b","\'=1+1"');
 });
 it("uses supported font characters without PDF string double escaping", () => {
  const supported = new Set(Array.from({length:95},(_,i)=>i+32));
  expect(receiptDisplayText("Ng’andu 王 (A)\n",supported)).toBe("Ng?andu ? (A) ");
 });
 it("continues a receipt batch after a poisoned document and records its failure", async () => {
  const completed: number[]=[]; const failed: number[]=[];
  await runReceiptBatch([1,2], async id => { if(id===1)throw new Error("unsupported glyph");completed.push(id); },async id=>{failed.push(id);});
  expect(completed).toEqual([2]);expect(failed).toEqual([1]);
 });
 it("does not abandon other receipts when failure recording itself fails", async () => {
  const completed: number[]=[];
  await expect(runReceiptBatch([1,2], async id=>{if(id===1)throw new Error("document error");completed.push(id);},async()=>{throw new Error("ledger error");})).rejects.toThrow("could not be recorded");
  expect(completed).toEqual([2]);
 });
 it("distinguishes numeric provider identities but deduplicates reordered retry deliveries", async () => {
  const base = {workspace_id:2,event_type:"issue.open.created",created_at:100,payload:{issue_id:1},dispatched_at:101};
  expect(await aikidoEventKey(base)).not.toBe(await aikidoEventKey({...base,payload:{issue_id:2}}));
  expect(await aikidoEventKey(base)).toBe(await aikidoEventKey({payload:{issue_id:1},created_at:100,event_type:"issue.open.created",workspace_id:2,dispatched_at:102}));
  expect(await aikidoEventKey(base)).not.toBe(await aikidoEventKey({...base,workspace_id:"2"}));
 });
});
