import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { corsHeadersFor } from "../_shared/cors.ts";
import { requirePrivilegedMfa } from "../_shared/privileged-auth.ts";
import { readBoundedBytes, RequestError } from "../_shared/request-security.ts";

Deno.serve(async (req) => {
 const cors=corsHeadersFor(req,"POST");
 const json=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json(405,{error:"METHOD_NOT_ALLOWED"});
 try {
  const url=Deno.env.get("SUPABASE_URL")!;
  const header=req.headers.get("authorization");
  const client=createClient(url,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:header??""}},auth:{persistSession:false,autoRefreshToken:false}});
  const access=await requirePrivilegedMfa({
   auth:client.auth,
   accountForUser:id=>client.from("profiles").select("account_status").eq("user_id",id).maybeSingle(),
   rolesForUser:id=>client.from("user_roles").select("role").eq("user_id",id).eq("role","super_admin"),
  },header);
  if(access.status)return json(access.status,{error:access.code});
  if(access.role!=="super_admin")return json(403,{error:"SUPER_ADMIN_REQUIRED"});
  const body=JSON.parse(new TextDecoder().decode(await readBoundedBytes(req,4096,10000)));
  const email=typeof body.email==="string"?body.email.trim().toLowerCase():"";
  const fullName=typeof body.fullName==="string"?body.fullName.trim():"";
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||fullName.length<2||fullName.length>100)
   return json(400,{error:"VALID_NAME_AND_EMAIL_REQUIRED"});
  const admin=createClient(url,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:quota,error:quotaError}=await admin.rpc("consume_edge_request",{p_user_id:access.userId,p_function_name:"upload-kyc-document",p_nonce:crypto.randomUUID()});
  if(quotaError||!quota)return json(503,{error:"INTAKE_UNAVAILABLE"});
  if(!quota.allowed)return json(429,{error:"INTAKE_RATE_LIMIT"});
  // No invitation, confirmation, password or borrower consent is sent/created.
  // Auth's existing signup trigger creates the linked Marketplace profile.
  const {data,error}=await admin.auth.admin.createUser({email,email_confirm:false,user_metadata:{full_name:fullName}});
  if(error||!data.user)return json(409,{error:"ACCOUNT_NOT_CREATED_USE_EXISTING_PROFILE_OR_RETRY"});
  const {error:auditError}=await admin.from("audit_logs").insert({user_id:access.userId,role:"super_admin",action_performed:"assisted_profile_created",record_id:data.user.id,table_name:"profiles",new_value:{source:"super_admin_assisted"}});
  return json(201,{user_id:data.user.id,audit_recorded:!auditError});
 } catch(error) {
  if(error instanceof RequestError)return json(error.status,{error:error.code});
  return json(400,{error:"INTAKE_REQUEST_FAILED"});
 }
});
