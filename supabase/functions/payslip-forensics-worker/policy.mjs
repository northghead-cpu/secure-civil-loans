export const AUDIENCE = 'riverbanc-payslip-forensics';
export function allowedClaims(p) {
 return p.repository_id==='1197102403' && p.repository_owner_id==='271791151' &&
 p.repository==='northghead-cpu/secure-civil-loans' && p.ref==='refs/heads/main' &&
 p.workflow_ref==='northghead-cpu/secure-civil-loans/.github/workflows/payslip-forensics.yml@refs/heads/main' &&
 p.runner_environment==='github-hosted' && ['schedule','workflow_dispatch'].includes(p.event_name);
}
export function validResult(r) {
 return !!r && ['review_required','no_indicators_detected','error'].includes(r.status) &&
 r.authenticity_verified===false && /^[0-9a-f]{64}$/.test(r.sha256) &&
 Array.isArray(r.findings) && r.findings.length<=100 && JSON.stringify(r).length<=30000 &&
 (r.status!=='no_indicators_detected' || (r.findings.length===0 && Array.isArray(r.textless_pages) && r.textless_pages.length===0));
}
