import { createReceiptPdf } from "../../functions/process-monthly-payroll-receipts/pdf.ts";
import type { Receipt } from "../../functions/process-monthly-payroll-receipts/pdf.ts";
Deno.test("real PDF font accepts Unicode borrower data through display fallback",async()=>{
 const pdf=await createReceiptPdf({receipt_number:"R-1",customer_name:"Ng’andu 王 😀",currency:"ZMW",amount:60,payroll_reference:"参考",billing_period_start:"2026-10-01",billing_period_end:"2026-10-31",issued_at:"2026-10-24"} as Receipt);
 if(new TextDecoder().decode(pdf.slice(0,4))!=="%PDF")throw new Error("not a PDF");
});
Deno.test("reference GET denies suspended callers and never caches user-scoped catalogue/comparison",async()=>{
 const oldServe=Deno.serve, oldFetch=globalThis.fetch;
 let handler: (r:Request)=>Promise<Response>;let suspended=true;let redis=0;let queries=0;
 const names=["SUPABASE_URL","SUPABASE_ANON_KEY","UPSTASH_REDIS_REST_URL","UPSTASH_REDIS_REST_TOKEN"];
 const previous=names.map(n=>Deno.env.get(n));
 try {
  Deno.env.set(names[0],"https://dummy.invalid");Deno.env.set(names[1],"dummy-key");Deno.env.set(names[2],"https://cache.invalid");Deno.env.set(names[3],"dummy-cache-token");
  Deno.serve=((h:unknown)=>{handler=h as typeof handler;return {};}) as typeof Deno.serve;
  globalThis.fetch=((input:RequestInfo|URL)=>{
   const url=String(input instanceof Request?input.url:input);
   if(url.startsWith("https://cache.invalid")){redis++;return Promise.resolve(Response.json({result:null}));}
   if(url.includes("/auth/v1/user"))return Promise.resolve(Response.json({id:"00000000-0000-4000-8000-000000000001",aud:"authenticated"}));
   if(url.includes("/rest/v1/profiles"))return Promise.resolve(Response.json({account_status:suspended?"suspended":"active"}));
   if(url.includes("/rest/v1/bank_products")){queries++;return Promise.resolve(Response.json(queries===1?[]:[{id:"product",bank_name:"Synthetic",interest_rate:10,min_amount:1,max_amount:100000,max_term_months:12} ]));}
   throw new Error("Unexpected external request: "+url);
  }) as typeof fetch;
  await import("../../functions/reference-data/index.ts");
  const request=(resource:string)=>new Request("https://local.invalid/?resource="+resource,{headers:{Authorization:"Bearer dummy-token"}});
  if((await handler!(request("catalogue"))).status!==403||redis||queries)throw new Error("suspended caller reached data/cache");
  suspended=false;
  const first=await handler!(request("catalogue"));const second=await handler!(request("catalogue"));
  if(first.status!==200||second.status!==200||(await second.json()).data.length!==1||queries!==2||redis!==0)throw new Error("shared RLS cache poisoning");
  const comparison=await handler!(request("comparison"));if(comparison.status!==200||redis!==0||comparison.headers.get("Cache-Control")!=="private, no-store")throw new Error("comparison cached");
 } finally {
  Deno.serve=oldServe;globalThis.fetch=oldFetch;
  names.forEach((n,i)=>previous[i]===undefined?Deno.env.delete(n):Deno.env.set(n,previous[i]!));
 }
});
Deno.test("patched loan and CRB validators retain strict input validation", async () => {
 const oldServe=Deno.serve;
 try {
  Deno.serve=(()=>({})) as unknown as typeof Deno.serve;
  const {ProcessLoanSchema}=await import("../../functions/process-loan/index.ts");
  const {CRBRequestSchema}=await import("../../functions/crb-proxy/index.ts");
  const loan={zmw_client_id:"client_123",income_zmw:9000,debt_zmw:1000};
  if(!ProcessLoanSchema.safeParse(loan).success)throw new Error("valid loan rejected");
  for(const bad of [{...loan,income_zmw:-1},{...loan,debt_zmw:Infinity},{...loan,unexpected:true}]) {
   const parsed=ProcessLoanSchema.safeParse(bad);
   if(parsed.success||!parsed.error.flatten())throw new Error("invalid loan accepted");
  }
  const crb={nrc_number:"123456/78/1",full_name:"Brian Ngandu"};
  if(!CRBRequestSchema.safeParse(crb).success)throw new Error("valid CRB request rejected");
  for(const bad of [{...crb,nrc_number:"../private"},{...crb,full_name:"<script>"},{...crb,unexpected:true}]) {
   const parsed=CRBRequestSchema.safeParse(bad);
   if(parsed.success||!parsed.error.flatten())throw new Error("invalid CRB request accepted");
  }
 } finally {Deno.serve=oldServe;}
});
