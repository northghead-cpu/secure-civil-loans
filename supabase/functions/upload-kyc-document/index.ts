import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { corsHeadersFor } from "../_shared/cors.ts";
import { RequestError, readBoundedBytes } from "../_shared/request-security.ts";
import { validateDocument, MAX_DOCUMENT_BYTES } from "./validate.ts";

Deno.serve(async (req: Request) => {
  const cors=corsHeadersFor(req,"POST");
  const url=Deno.env.get("SUPABASE_URL")!;
  if (url==="https://mioppvtzbaixeeuxkroo.supabase.co" && ["http://localhost:4173","http://127.0.0.1:4173","https://riverbanc-tech-dnye0t1qi-riverbank1.vercel.app"].includes(req.headers.get("origin")??"")) cors["Access-Control-Allow-Origin"]=req.headers.get("origin")!;
  const json=(status:number,error:unknown)=>new Response(JSON.stringify(error),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json(405,{error:"METHOD_NOT_ALLOWED"});
  try {
    const header=req.headers.get("authorization");
    if(!header?.startsWith("Bearer "))return json(401,{error:"AUTH_REQUIRED"});
    const client=createClient(url,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:header}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error}=await client.auth.getUser(header.slice(7));
    if(error||!user)return json(401,{error:"AUTH_REQUIRED"});
    // Current account/role restrictions, including privileged MFA, are checked
    // by the same invoker guard used by the KYC database workflows.
    const {error:accessError}=await client.rpc("require_document_upload_session");
    if(accessError)return json(403,{error:"UPLOAD_NOT_AUTHORIZED"});
    const kind=new URL(req.url).searchParams.get("kind");
    if(!["nrc","gov-id","payslip","introductory-letter"].includes(kind??""))return json(400,{error:"INVALID_DOCUMENT_KIND"});
    if(req.headers.get("content-encoding") && req.headers.get("content-encoding")!=="identity")return json(415,{error:"CONTENT_ENCODING_NOT_SUPPORTED"});
    const mime=req.headers.get("content-type")?.split(";")[0].trim().toLowerCase()??"";
    if(!["application/pdf","image/jpeg","image/png"].includes(mime))return json(415,{error:"UNSUPPORTED_DOCUMENT_TYPE"});
    const admin=createClient(url,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:quota,error:quotaError}=await admin.rpc("consume_edge_request",{p_user_id:user.id,p_function_name:"upload-kyc-document",p_nonce:crypto.randomUUID()});
    if(quotaError||!quota||typeof quota.allowed!=="boolean")return json(503,{error:"UPLOAD_UNAVAILABLE"});
    if(!quota.allowed)return json(429,{error:"UPLOAD_RATE_LIMIT"});
    const document=await validateDocument(await readBoundedBytes(req,MAX_DOCUMENT_BYTES,10000),mime);
    const {error:changedAccess}=await client.rpc("require_document_upload_session");
    if(changedAccess)return json(403,{error:"UPLOAD_NOT_AUTHORIZED"});
    const path=`${user.id}/${kind}-${Date.now()}.${document.extension}`;
    const {error:uploadError}=await admin.storage.from("kyc-documents").upload(path,document.bytes,{contentType:document.mime,upsert:false});
    if(uploadError)return json(503,{error:"UPLOAD_UNAVAILABLE"});
    return json(201,{path,mime:document.mime,size:document.bytes.byteLength});
  } catch(error) {
    if(error instanceof RequestError)return json(error.status,{error:error.code});
    return json(500,{error:"UPLOAD_FAILED"});
  }
});
