import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { untypedDb } from "@/integrations/supabase/untyped";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Customer = { user_id: string; full_name: string | null; nrc_number: string | null; kyc_status: string | null; kyc_review_revision: string };
type Details = { fullName: string; nrcNumber: string; phone: string; employer: string; employeeNumber: string; govIdType: string; govIdNumber: string };
const empty: Details = { fullName:"",nrcNumber:"",phone:"",employer:"",employeeNumber:"",govIdType:"passport",govIdNumber:"" };
const labels: Record<keyof Details,string> = {fullName:"Full legal name",nrcNumber:"NRC number",phone:"Phone number",employer:"Employer / ministry",employeeNumber:"Employee number",govIdType:"Government ID type",govIdNumber:"Government ID number"};
type Slot = {key:string;label:string;kind:string;type:string;period?:string};
function slots(): Slot[] {
 const today=new Date();
 return [
  {key:"nrc",label:"NRC",kind:"nrc",type:"NRC"},
  {key:"gov-id",label:"Government ID",kind:"gov-id",type:"GOV_ID"},
  {key:"introductory-letter",label:"Introductory letter",kind:"introductory-letter",type:"INTRODUCTORY_LETTER"},
  ...[1,2,3].map(n=>{
   const month=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth()-n,1));
   const period=month.toISOString().slice(0,10);
   return {key:period,label:"Payslip — "+month.toLocaleDateString("en-ZM",{month:"long",year:"numeric",timeZone:"UTC"}),kind:"payslip",type:"PAYSLIP",period};
  }),
 ];
}
export default function AssistedKycIntake({customers,onSaved}:{customers:Customer[];onSaved:()=>Promise<void>}) {
 const [details,setDetails]=useState<Details>(empty);
 const [email,setEmail]=useState("");
 const [target,setTarget]=useState("");
 const [files,setFiles]=useState<Record<string,File>>({});
 const [busy,setBusy]=useState(false);
 const [confirmed,setConfirmed]=useState(false);
 const [status,setStatus]=useState("");
 const [createdId,setCreatedId]=useState("");
 const [revision,setRevision]=useState("");
 const [formVersion,setFormVersion]=useState(0);
 const [requestSlots]=useState(slots);
 const uploaded=useRef<Record<string,{file:File;path:string}>>({});
 const targetId=createdId||target;
 const change=(key:keyof Details,value:string)=>{setDetails(d=>({...d,[key]:value}));setConfirmed(false);};
 const selectTarget=async(id:string)=>{
  setTarget(id);setCreatedId("");setRevision("");setFormVersion(v=>v+1);setFiles({});uploaded.current={};setConfirmed(false);setDetails(empty);
  if(!id)return;
  setBusy(true);
  try {
   const {data,error}=await untypedDb.from("profiles").select("full_name,nrc_number,phone,employer,employee_number,gov_id_type,gov_id_number,kyc_review_revision").eq("user_id",id).single();
   if(error)throw error;
   setRevision(data.kyc_review_revision);
   setDetails({fullName:data.full_name??"",nrcNumber:data.nrc_number??"",phone:data.phone??"",employer:data.employer??"",employeeNumber:data.employee_number??"",govIdType:data.gov_id_type??"passport",govIdNumber:data.gov_id_number??""});
  } catch {toast.error("Customer details could not load. Select the profile again.");setTarget("");}
  finally {setBusy(false);}
 };
 const extract=async()=>{
  setBusy(true);setStatus("Reading documents…");
  try {
   const next:Partial<Details>={};
   if(files.nrc){
    const {parseNRC}=await import("@/services/idDocumentParsingService");
    const result=await parseNRC(files.nrc);
    if(result.full_name)next.fullName=result.full_name;
    if(result.document_number)next.nrcNumber=result.document_number;
   }
   const payslip=requestSlots.find(s=>s.type==="PAYSLIP"&&files[s.key]);
   if(payslip){
    const {parsePayslip}=await import("@/services/payrollParsingService");
    const result=await parsePayslip(files[payslip.key]);
    if(result.full_name&&!next.fullName)next.fullName=result.full_name;
    if(result.nrc_number&&!next.nrcNumber)next.nrcNumber=result.nrc_number;
    if(result.employer)next.employer=result.employer;
    if(result.employee_number)next.employeeNumber=result.employee_number;
   }
   setDetails(d=>Object.fromEntries(Object.entries(d).map(([key,value])=>[key,value||next[key as keyof Details]||""])) as Details);
   setConfirmed(false);
   toast.info("Review all details against the originals. Unreadable fields must be entered manually.");
  } catch {toast.error("Extraction could not finish. Enter the details manually.");}
  finally{setBusy(false);setStatus("");}
 };
 const submit=async()=>{
  if(busy)return;
  if(!confirmed||requestSlots.some(s=>!files[s.key])){toast.error("Add all six documents and confirm the customer details.");return;}
  if(!details.fullName.trim()||!/^\d{6}\/\d{2}\/\d$/.test(details.nrcNumber)||!/^\+?[0-9 -]{9,20}$/.test(details.phone)||!details.employer.trim()||!details.employeeNumber.trim()||!details.govIdNumber.trim()){toast.error("Complete the customer details, including a valid NRC and phone number.");return;}
  if(!targetId&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())){toast.error("Enter the customer's email address.");return;}
  setBusy(true);
  let id=targetId;
  try {
   if(!id){
    setStatus("Creating customer profile…");
    const {data,error}=await supabase.functions.invoke("admin-create-customer",{body:{email:email.trim(),fullName:details.fullName.trim()}});
    if(error||!data?.user_id)throw new Error("Profile creation failed. If the email already exists, choose the existing customer profile.");
    id=data.user_id;setCreatedId(id);
    if(data.audit_recorded===false)toast.warning("Profile created, but its creation audit needs administrator attention.");
   }
   let expectedRevision=revision;
   if(!expectedRevision){
    const {data:profile,error:profileError}=await untypedDb.from("profiles").select("kyc_review_revision").eq("user_id",id).single();
    if(profileError||!profile)throw new Error("Profile could not load. Keep this form open and retry.");
    expectedRevision=profile.kyc_review_revision;setRevision(expectedRevision);
   }
   const documents=[];
   for(const slot of requestSlots){
    const file=files[slot.key];
    let cached=uploaded.current[slot.key];
    if(!cached||cached.file!==file){
     setStatus("Uploading "+slot.label+"…");
     const {data,error}=await supabase.functions.invoke("upload-kyc-document?kind="+slot.kind+"&target_user_id="+encodeURIComponent(id),{body:file,headers:{"Content-Type":file.type}});
     if(error||!data?.path)throw new Error(slot.label+" could not upload. Check the file and retry.");
     cached={file,path:data.path};uploaded.current[slot.key]=cached;
    }
    documents.push({document_type:slot.type,storage_path:cached.path,pay_period:slot.period??null});
   }
   setStatus("Saving documents for review…");
   const {error}=await untypedDb.rpc("submit_assisted_kyc",{_user_id:id,_details:details,_documents:documents,_expected_revision:expectedRevision});
   if(error)throw new Error(error.message||"The submission could not be saved.");
   toast.success("Customer profile and six documents are ready for review.");
   setRevision("");setFormVersion(v=>v+1);setDetails(empty);setFiles({});setEmail("");setTarget("");setCreatedId("");setConfirmed(false);uploaded.current={};
   await onSaved();
  } catch(error){toast.error(error instanceof Error?error.message:"Intake failed. Keep this form open and retry.");}
  finally{setBusy(false);setStatus("");}
 };
 return <section className="rounded-lg border bg-card p-5 space-y-4" aria-label="Assisted customer intake">
  <h2 className="text-lg font-semibold">Upload documents for a customer</h2>
  <p className="text-sm text-muted-foreground">Create a customer profile or select an existing profile. Review extracted details, then submit the documents for approval.</p>
  <fieldset key={formVersion} disabled={busy} className="space-y-4">
   <div><Label htmlFor="assisted-customer">Customer</Label><select id="assisted-customer" className="w-full rounded border bg-background p-2" value={target} disabled={!!createdId} onChange={e=>void selectTarget(e.target.value)}><option value="">Create a new customer profile</option>{customers.filter(c=>!["COMPLETED","VERIFIED","IN_REVIEW"].includes(c.kyc_status??"")).map(c=><option key={c.user_id} value={c.user_id}>{c.full_name||"Unnamed customer"} · {c.nrc_number||c.user_id}</option>)}</select></div>
   {!target&&<div><Label htmlFor="assisted-email">Customer email</Label><Input id="assisted-email" type="email" maxLength={254} disabled={!!createdId} value={email} onChange={e=>setEmail(e.target.value)}/></div>}
   {createdId&&<p role="status" className="text-sm">Profile created. Retry here to finish uploading for this customer. No account invitation has been sent.</p>}
   <div className="grid gap-4 md:grid-cols-2">{requestSlots.map(slot=><div key={slot.key}><Label htmlFor={"assisted-"+slot.key}>{slot.label}</Label><Input id={"assisted-"+slot.key} type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={e=>{
    const file=e.target.files?.[0];if(!file)return;
    if(!["application/pdf","image/png","image/jpeg"].includes(file.type)||!file.size||file.size>5*1024*1024){toast.error("Use PDF, PNG or JPEG files up to 5 MB.");e.target.value="";return;}
    setFiles(f=>({...f,[slot.key]:file}));delete uploaded.current[slot.key];setConfirmed(false);
   }}/>{files[slot.key]&&<p className="text-xs text-muted-foreground">{files[slot.key].name}</p>}</div>)}</div>
   <Button type="button" variant="outline" disabled={!files.nrc&&!requestSlots.some(s=>s.type==="PAYSLIP"&&files[s.key])} onClick={()=>void extract()}>Extract profile details</Button>
   <div className="grid gap-4 md:grid-cols-2">{(Object.keys(labels) as (keyof Details)[]).map(key=><div key={key}><Label htmlFor={"assisted-"+key}>{labels[key]}</Label>{key==="govIdType"?<select id={"assisted-"+key} className="w-full rounded border bg-background p-2" value={details[key]} onChange={e=>change(key,e.target.value)}><option value="passport">Passport</option><option value="driving_license">Driving licence</option><option value="employee_id">Government employee ID</option></select>:<Input id={"assisted-"+key} maxLength={key==="employer"?150:key==="phone"?20:key==="fullName"?100:50} value={details[key]} onChange={e=>change(key,e.target.value)}/>}</div>)}</div>
   <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I checked the customer details and document months against the originals.</label>
   <p className="text-xs text-muted-foreground">Document extraction suggests fields for review. Uploading does not verify authenticity, record the customer's signature, or authorise subscription deductions or lender sharing.</p>
   <Button type="button" disabled={!confirmed||requestSlots.some(s=>!files[s.key])} onClick={()=>void submit()}>Create profile and submit for review</Button>
  </fieldset>
  {status&&<p role="status">{status}</p>}
 </section>;
}
