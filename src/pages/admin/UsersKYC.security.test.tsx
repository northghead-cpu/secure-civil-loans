import { it, expect, vi, beforeEach } from "vitest";
import { render,screen,fireEvent,waitFor } from "@testing-library/react";
import UsersKYC from "./UsersKYC";
const mocks=vi.hoisted(()=>({read:vi.fn(),rpc:vi.fn(),download:vi.fn(),parse:vi.fn()}));
vi.mock("@/hooks/useRBAC",()=>({useRBAC:()=>({hasRole:(r:string)=>r==="admin"})}));
vi.mock("@/lib/readAllRows",()=>({readAllRows:mocks.read}));
vi.mock("@/integrations/supabase/untyped",()=>({untypedDb:{rpc:mocks.rpc}}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{storage:{from:()=>({download:mocks.download})}}}));
vi.mock("@/services/payrollParsingService",()=>({parsePayslip:mocks.parse}));
beforeEach(()=>{vi.clearAllMocks();mocks.read.mockReset();mocks.download.mockReset();mocks.parse.mockReset();mocks.rpc.mockReset();});
vi.mock("sonner",()=>({toast:{error:vi.fn(),success:vi.fn()}}));
it("sends the displayed revision and discards the stale review after server rejection",async()=>{
 const profile={user_id:"borrower",full_name:"Synthetic Borrower",kyc_status:"IN_REVIEW",kyc_submitted_at:"2026-10-24",kyc_review_revision:"revision-a"};
 mocks.read.mockResolvedValueOnce([profile]).mockResolvedValueOnce([{id:"doc-a",document_type:"NRC",validation_status:"PENDING"}]).mockResolvedValueOnce([{...profile,kyc_review_revision:"revision-b"}]);
 mocks.rpc.mockResolvedValue({error:{message:"KYC submission changed; refresh the evidence before reviewing"}});
 render(<UsersKYC/>);fireEvent.click(await screen.findByRole("button",{name:"Review evidence"}));
 const verify=await screen.findByRole("button",{name:"Verify KYC"});await waitFor(()=>expect(verify).toBeEnabled());fireEvent.click(verify);
 await waitFor(()=>expect(mocks.rpc).toHaveBeenCalledWith("review_kyc_verification",{_user_id:"borrower",_status:"COMPLETED",_reason:null,_expected_revision:"revision-a"}));
 await waitFor(()=>expect(screen.queryByRole("button",{name:"Verify KYC"})).not.toBeInTheDocument());expect(mocks.read).toHaveBeenCalledTimes(3);
});
it("shows consistency warnings from authorized evidence without making a decision",async()=>{
 mocks.read.mockResolvedValueOnce([{user_id:"borrower",full_name:"Kalaba Mwansa",nrc_number:"987654/32/1",kyc_status:"IN_REVIEW",kyc_submitted_at:"2026-11-01",kyc_review_revision:"revision-a"}]).mockResolvedValueOnce([{id:"pay-a",document_type:"PAYSLIP",storage_path:"borrower/test.png",pay_period:"2026-10-01",validation_status:"PENDING"}]);
 mocks.download.mockResolvedValue({data:new Blob(["synthetic"],{type:"image/png"}),error:null});
 mocks.parse.mockResolvedValue({layout:"smart_zambia_reference",success:true,full_name:"KALABA MWANSA",nrc_number:"987654/32/1",pay_period:"October 2026",review_flags:[{code:"TOTALS_MISMATCH",message:"Gross earnings minus deductions does not match net pay."}]});
 render(<UsersKYC/>);fireEvent.click(await screen.findByRole("button",{name:"Review evidence"}));
 fireEvent.click(await screen.findByRole("button",{name:"Check payslip consistency"}));
 await screen.findByText("Gross earnings minus deductions does not match net pay.");
 expect(mocks.download).toHaveBeenCalledWith("borrower/test.png");expect(mocks.rpc).not.toHaveBeenCalled();
});
it("reports denied evidence access without calling OCR or approving KYC",async()=>{
 mocks.read.mockResolvedValueOnce([{user_id:"borrower",kyc_status:"IN_REVIEW",kyc_submitted_at:"2026-11-01",kyc_review_revision:"revision-a"}]).mockResolvedValueOnce([{id:"pay-a",document_type:"PAYSLIP",storage_path:"borrower/test.png",pay_period:"2026-10-01",validation_status:"PENDING"}]);
 mocks.download.mockResolvedValue({data:null,error:{message:"access denied"}});
 render(<UsersKYC/>);fireEvent.click(await screen.findByRole("button",{name:"Review evidence"}));
 fireEvent.click(await screen.findByRole("button",{name:"Check payslip consistency"}));
 await screen.findByText("The check could not complete. Review the original evidence or retry.");
 expect(mocks.parse).not.toHaveBeenCalled();expect(mocks.rpc).not.toHaveBeenCalled();
});
