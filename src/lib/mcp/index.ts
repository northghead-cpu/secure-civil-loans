import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getMyKycStatus from "./tools/get-my-kyc-status";
import listMyLoanApplications from "./tools/list-my-loan-applications";
import listLenderProducts from "./tools/list-lender-products";
import checkAffordability from "./tools/check-affordability";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "riverbanc-technology",
  title: "RIVERBANC TECHNOLOGY",
  version: "0.1.0",
  instructions:
    "Tools for Riverbanc, a lending platform for Zambian civil servants. Use `get_my_kyc_status` for the signed-in user's verification and consent state, `list_my_loan_applications` for their applications, `list_lender_products` to compare active lender offers, and `check_affordability` to apply the one-third-of-net-salary rule.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getMyKycStatus, listMyLoanApplications, listLenderProducts, checkAffordability],
});
