# Riverbanc Production Publish Fix Design

## Goal
Restore reliable production publishing for Riverbanc Technology Limited, make `https://riverbanc.co.zm` the single public production domain, and prevent deployment failures from being mistaken for Lovable synchronization problems.

## Confirmed Current State
- GitHub `main` and Lovable are synchronized to commit `e6b900150b893419fcf0a4d784d1f5628c6a6a65`.
- Vercel detects that commit on `main` but the production deployment fails during `npm run build`.
- The confirmed compiler failure is malformed JSX in `src/pages/ComparePage.tsx`, specifically an unclosed/mismatched `Select`/`TabsContent` structure.
- Vercel-generated deployment aliases contain `riverbanc1` because that value is part of the Vercel account/team naming context; it is not the Riverbanc public brand.
- `https://riverbanc.co.zm` is the sole intended public production domain.
- Lovable's zero-credit state prevents Lovable's AI agent from performing AI editing work, but it is not the cause of the Vercel build failure.

## Design
### 1. Build repair
Repair only the malformed JSX in `src/pages/ComparePage.tsx`, preserving the current Riverbanc functionality and branding. The provider filter must contain a properly nested `Select`, and each `TabsContent` must be closed in the correct hierarchy. After the repair, run the production build and inspect for any additional TypeScript, JSX, or lint failures before considering the build fixed.

### 2. Deployment verification
Use the corrected `main` commit as the deployment source. A deployment is considered successful only when Vercel reports `READY`, the production target is active, and the deployed commit SHA matches the corrected GitHub `main` SHA. A created deployment object with `PENDING` status is not sufficient evidence.

### 3. Domain normalization
Keep `riverbanc.co.zm` as the only public production domain. Do not rename or delete the Vercel project/account blindly. Inspect the current custom-domain configuration first. Remove or de-emphasize any unintended public aliases only when the configuration can be changed safely. Generated `.vercel.app` deployment URLs may continue to exist as technical preview/deployment addresses, but application metadata and canonical URLs must point to `riverbanc.co.zm`.

### 4. Lovable credits
Treat the zero-credit state as an operational limitation, not an application build defect. Do not alter application code to work around credits. Once the code is fixed in GitHub and Vercel is healthy, Lovable can resume AI editing when credits are available.

## Success Criteria
1. `npm run build` passes without JSX, TypeScript, or lint errors.
2. Vercel production deployment reaches `READY` for the corrected `main` commit.
3. `riverbanc.co.zm` resolves to the intended production deployment.
4. The live deployment serves the corrected application build.
5. Riverbanc branding is not replaced by `Riverbanc` in public canonical/domain configuration.
6. No destructive Vercel account/project rename is performed without evidence that it is required and safe.
