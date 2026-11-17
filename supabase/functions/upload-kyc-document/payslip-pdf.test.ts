import { PDFDocument,StandardFonts } from "npm:pdf-lib@1.17.1";
import createQpdf from "npm:@neslinesli93/qpdf-wasm@0.3.1";
import { readFile } from "node:fs/promises";
import { selectPayslipMonth,pageMatches } from "./payslip-pdf.ts";
const check=(value:unknown)=>{if(!value)throw new Error("Assertion failed");};
Deno.test("month matching uses employee and pay-month labels, not deduction dates",()=>{
 check(pageMatches("EMPLOYEE NO NRC\n00174559 123456/78/1\nPAY MONTH 2026-09-30","00174559","2026-09-01"));
 check(!pageMatches("EMPLOYEE NO 00174559 PAY MONTH 2026-09-30 Deduction October 2026","00174559","2026-10-01"));
 check(!pageMatches("EMPLOYEE NO 999999 PAY MONTH 2026-09-30","00174559","2026-09-01"));
});
Deno.test({name:"encrypted multi-month PDF unlocks and returns matching pages only",sanitizeResources:false,sanitizeOps:false,fn:async()=>{
 const doc=await PDFDocument.create();const font=await doc.embedFont(StandardFonts.Helvetica);
 for(const month of ["08","09","10"])doc.addPage().drawText("EMPLOYEE NO 00174559\nPAY MONTH 2026-"+month+"-30",{font,size:12});
 const input=await doc.save();
 const qpdf=await createQpdf({noInitialRun:true,print:()=>{},printErr:()=>{},wasmBinary:await readFile(new URL("./qpdf.wasm",import.meta.resolve("npm:@neslinesli93/qpdf-wasm@0.3.1")))});
 qpdf.FS.writeFile("/in.pdf",input);
 qpdf.callMain(["--encrypt","00174559","owner-test-password","256","--","/in.pdf","/encrypted.pdf"]);
 const bytes=new Uint8Array(qpdf.FS.readFile("/encrypted.pdf"));
 for(const [i,month] of ["08","09","10"].entries()){
  const result=await selectPayslipMonth(bytes,"00174559","2026-"+month+"-01");
  check(result.source_pages.length===1&&result.source_pages[0]===i+1);
  check((await PDFDocument.load(result.bytes)).getPageCount()===1);
 }
 for(const [employee,period] of [["wrong","2026-09-01"],["00174559","2026-07-01"]]){
  let rejected=false;try{await selectPayslipMonth(bytes,employee,period);}catch{rejected=true;}check(rejected);
 }
 qpdf.FS.unlink("/in.pdf");qpdf.FS.unlink("/encrypted.pdf");
}});
