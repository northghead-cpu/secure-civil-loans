import { it, expect, vi } from "vitest";
import { render,screen,fireEvent,waitFor } from "@testing-library/react";
import UsersKYC from "./UsersKYC";
const mocks=vi.hoisted(()=>({read:vi.fn(),rpc:vi.fn()}));
vi.mock("@/hooks/useRBAC",()=>({useRBAC:()=>({hasRole:(r:string)=>r==="admin"})}));
vi.mock("@/lib/readAllRows",()=>({readAllRows:mocks.read}));
vi.mock("@/integrations/supabase/untyped",()=>({untypedDb:{rpc:mocks.rpc}}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{}}));
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
