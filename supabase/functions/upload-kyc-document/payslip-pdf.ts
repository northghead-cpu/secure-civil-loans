import createQpdf from "npm:@neslinesli93/qpdf-wasm@0.3.1";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "npm:pdf-lib@1.17.1";
import { getDocumentProxy, extractText } from "npm:unpdf@2.2.1";
import { validateDocument, MAX_DOCUMENT_BYTES } from "./validate.ts";
import { RequestError } from "../_shared/request-security.ts";

const months=["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
export function pageMatches(text:string,employee:string,period:string):boolean {
 const normalized=employee.replace(/\s/g,"").toUpperCase();
 const ids=[...text.matchAll(/(?:EMPLOYEE\s*(?:NO\.?|NUMBER|ID)|PAYROLL\s*(?:NO\.?|NUMBER))\s*(?:NRC\s*)?[:#-]?\s*([A-Z0-9/-]{3,50})/gi)].map(m=>m[1].toUpperCase());
 if(!ids.includes(normalized))return false;
 const dates=[...text.matchAll(/(?:PAY\s*MONTH|PAY\s*PERIOD|SALARY\s*MONTH)\s*[:#-]?\s*(\d{4}[-/]\d{2}(?:[-/]\d{2})?|[A-Za-z]+\s+\d{4}|\d{2}[-/]\d{4})/gi)];
 return dates.some(m=>{
  const value=m[1];let year="",month="";
  const iso=value.match(/^(\d{4})[-/](\d{2})/);
  const named=value.match(/^([A-Za-z]+)\s+(\d{4})$/);
  const numeric=value.match(/^(\d{2})[-/](\d{4})$/);
  if(iso){year=iso[1];month=iso[2];}
  else if(named){year=named[2];month=String(months.indexOf(named[1].slice(0,3).toLowerCase())+1).padStart(2,"0");}
  else if(numeric){year=numeric[2];month=numeric[1];}
  return year+"-"+month+"-01"===period;
 });
}
export async function unlockPayslip(bytes:Uint8Array,employee:string):Promise<Uint8Array>{
 try{await PDFDocument.load(bytes,{ignoreEncryption:false});return bytes;}catch{
  // The only attempted password is the entered employee number. No logs or persistence.
  const qpdf=await createQpdf({noInitialRun:true,print:()=>{},printErr:()=>{},
   wasmBinary:await readFile(new URL("./qpdf.wasm",import.meta.resolve("npm:@neslinesli93/qpdf-wasm@0.3.1")))});
  try{
   qpdf.FS.writeFile("/input.pdf",bytes);
   const code=qpdf.callMain(["--password="+employee,"--decrypt","/input.pdf","/output.pdf"]);
   if(code!==0&&code!==3)throw new Error("Unlock failed");
   const result=new Uint8Array(qpdf.FS.readFile("/output.pdf"));
   if(result.length>MAX_DOCUMENT_BYTES)throw new RequestError(413,"DOCUMENT_SIZE_LIMIT");
   return result;
  }catch{throw new RequestError(422,"PAYSLIP_PASSWORD_OR_PDF_INVALID");}
  finally{for(const p of ["/input.pdf","/output.pdf"]){try{qpdf.FS.unlink(p);}catch{/* absent */}}}
 }
}
export async function selectPayslipMonth(bytes:Uint8Array,employee:string,period:string){
 if(!/^[A-Za-z0-9/-]{3,50}$/.test(employee)||!/^\d{4}-(0[1-9]|1[0-2])-01$/.test(period))throw new RequestError(400,"PAYSLIP_EMPLOYEE_AND_MONTH_REQUIRED");
 if(!bytes.length||bytes.length>MAX_DOCUMENT_BYTES)throw new RequestError(413,"DOCUMENT_SIZE_LIMIT");
 const clean=await validateDocument(await unlockPayslip(bytes,employee),"application/pdf");
 const proxy=await getDocumentProxy(clean.bytes.slice(),{isEvalSupported:false,maxImageSize:4_000_000});
 try{
  if(proxy.numPages>36)throw new RequestError(422,"PAYSLIP_PAGE_LIMIT");
  const extracted=await extractText(proxy,{mergePages:false});
  const pages=(extracted.text as string[]).flatMap((text,i)=>pageMatches(text,employee,period)?[i]:[]);
  if(!pages.length)throw new RequestError(422,"PAYSLIP_EMPLOYEE_OR_MONTH_NOT_FOUND");
  const source=await PDFDocument.load(clean.bytes);
  const selected=await PDFDocument.create();
  for(const page of await selected.copyPages(source,pages))selected.addPage(page);
  const document=await validateDocument(await selected.save(),"application/pdf");
  return {...document,source_pages:pages.map(i=>i+1),pay_period:period};
 }finally{await proxy.destroy();}
}
