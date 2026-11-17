import { useState } from 'react';
import { untypedDb } from '@/integrations/supabase/untyped';
import { Button } from '@/components/ui/button';
type Result={status:string;checked_at?:string;result?:{findings?:{code:string;detail:string}[]}};
const labels:Record<string,string>={pending:'Queued for PDF analysis.',processing:'PDF analysis is running.',review_required:'Document requires manual review.',no_indicators_detected:'No manipulation indicators detected. Authenticity remains unverified.',unsupported:'Image evidence requires manual review; PDF analysis does not apply.',error:'Analysis failed. Review the original evidence.',stale:'Evidence changed after analysis. Review the current original.',not_checked:'This document has not been checked.'};
export function PayslipForensics({documentId}:{documentId:string}){
 const [result,setResult]=useState<Result|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState(false);
 const load=async()=>{
  setBusy(true);setError(false);
  try{const {data,error}=await untypedDb.rpc('get_payslip_forensics',{p_document_id:documentId});if(error||!data)throw Error();setResult(data as Result);}
  catch{setError(true);setResult(null);}finally{setBusy(false);}
 };
 return <section className="mt-3 space-y-2" aria-label="Payslip manipulation review">
  <Button size="sm" variant="outline" disabled={busy} onClick={()=>void load()}>{busy?'Loading document check.':'View PDF manipulation check'}</Button>
  {error&&<p role="alert">Document check unavailable. Review the original evidence.</p>}
  {result&&<><p role="status">{labels[result.status]??'Document check unavailable.'}</p>
   {result.checked_at&&<p className="text-xs">Checked: {new Date(result.checked_at).toLocaleString()}</p>}
   {!!result.result?.findings?.length&&<ul className="list-disc pl-5 text-sm">{result.result.findings.map((f,i)=><li key={i}>{f.code}: {f.detail}</li>)}</ul>}
  </>}
  <p className="text-xs text-muted-foreground">Advisory only. Scanned or regenerated documents can hide edits. Verify salary and deductions with the issuer.</p>
 </section>;
}
