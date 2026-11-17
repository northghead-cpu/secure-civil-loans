import { useEffect,useState } from "react";
import { untypedDb } from "@/integrations/supabase/untyped";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
export default function KycExceptionApproval({userId,onSaved}:{userId:string;onSaved:()=>Promise<void>}) {
 const [missing,setMissing]=useState<string[]>([]);
 const [reasons,setReasons]=useState<Record<string,string>>({});
 const [revision,setRevision]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState(false);
 useEffect(()=>{let active=true;setRevision("");setError(false);
 void untypedDb.rpc("kyc_approval_requirements",{_user_id:userId}).then(({data,error})=>{
 if(!active)return;
 if(error){setError(true);return;}
 setMissing(data.missing);setReasons(data.saved||{});setRevision(data.revision);
 });return()=>{active=false;};},[userId]);
 const approve=async()=>{
 setBusy(true);
 try {
 const exceptions=Object.fromEntries(missing.map(k=>[k,(reasons[k]||"").trim()]));
 const {error}=await untypedDb.rpc("approve_kyc_with_exceptions",{_user_id:userId,_expected_revision:revision,_exceptions:exceptions});
 if(error)throw error;
 toast.success("Profile approved. Exceptions recorded.");await onSaved();
 }catch{toast.error("Approval failed. Refresh the evidence and check all skip reasons.");}
 finally{setBusy(false);}
 };
 return <section className="rounded border p-3 space-y-3"><h3 className="font-semibold">Super admin approval</h3>
 <p className="text-sm">Review supplied evidence. Record why each missing item is not required before approving.</p>
 {error&&<p role="alert">Requirements could not load. Close and reopen the review.</p>}
 {missing.map(k=><label key={k} className="block text-sm">{k.replace("field:","Field: ").replace("doc:","Document: ")} — Skip / Not required
 <Input disabled={busy} value={reasons[k]||""} maxLength={500} onChange={e=>setReasons(x=>({...x,[k]:e.target.value}))}/></label>)}
 <Button disabled={busy||!revision||missing.some(k=>(reasons[k]||"").trim().length<5)} onClick={()=>void approve()}>Approve profile{missing.length?" with exceptions":""}</Button>
 </section>;
}
