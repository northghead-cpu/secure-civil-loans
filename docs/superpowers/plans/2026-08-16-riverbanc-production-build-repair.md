# Riverbanc Production Build Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the confirmed production build failure in `ComparePage.tsx`, verify the full production build, and establish a verified deployment before changing public-domain configuration.

**Architecture:** Keep the existing React/Vite application structure unchanged. Make the smallest JSX correction needed to restore the component tree, then use the repository's existing build/check commands to validate the complete application. Deployment verification is performed against the GitHub `main` commit and Vercel production state.

**Tech Stack:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui, GitHub, Vercel.

## Global Constraints

- The only authorized repository is `northghead-cpu/secure-civil-loans`.
- `main` remains the production source branch.
- `https://riverbanc.co.zm` is the single public production domain.
- Do not rename or delete the Vercel project/account without evidence that it is required and safe.
- Do not modify unrelated application behavior while repairing the build.
- Do not report success until the build and deployment state have been independently verified.

---

### Task 1: Repair malformed JSX in ComparePage

**Files:**
- Modify: `src/pages/ComparePage.tsx`

**Interfaces:**
- Consumes: Existing `ComparePage` provider-filter UI and shadcn `Select`/`TabsContent` components.
- Produces: A syntactically valid `ComparePage` component whose JSX nesting is accepted by the TypeScript/Vite compiler.

- [ ] **Step 1: Inspect the exact current provider-filter block**

Confirm the provider filter has this intended nesting:

```tsx
<TabsContent value="loans" className="m-0">
  <label className="text-sm font-medium text-foreground mb-2 block">Provider</label>
  <Select value={providerFilter} onValueChange={setProviderFilter}>
    <SelectTrigger>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">Banks & Microfinance</SelectItem>
      <SelectItem value="bank">Banks only</SelectItem>
      <SelectItem value="microfinance">Microfinance only</SelectItem>
    </SelectContent>
  </Select>
</TabsContent>
```

- [ ] **Step 2: Replace only the malformed nesting**

Preserve the existing labels, values, handlers, and styling. Do not change the loan filtering behavior. The `Select` must close before the surrounding `TabsContent` closes.

- [ ] **Step 3: Review the complete JSX return tree**

Check the enclosing `<Tabs>`, `<TabsList>`, `<TabsContent>`, `<div>`, `<main>`, and `<Footer />` structure for mismatched closing tags. Do not introduce a refactor or component split during this repair.

- [ ] **Step 4: Commit the focused repair**

```bash
git add src/pages/ComparePage.tsx
git commit -m "fix: repair compare page JSX nesting"
```

### Task 2: Verify the production build

**Files:**
- Read: `package.json`
- Test: repository production build command defined by `package.json`

**Interfaces:**
- Consumes: The repaired `ComparePage.tsx` and existing package scripts.
- Produces: A successful production build with no JSX/TypeScript/compiler failure.

- [ ] **Step 1: Inspect package scripts**

Read `package.json` and use the repository's existing production build script rather than inventing a new command.

- [ ] **Step 2: Run the production build**

Run:

```bash
npm run build
```

Expected: exit code `0` and a completed Vite production build.

- [ ] **Step 3: If the build fails, fix only the newly evidenced build error**

Do not declare success from the first repaired error. If another concrete TypeScript/JSX/build error appears, inspect the referenced file and make the smallest necessary correction, then rerun the complete build.

- [ ] **Step 4: Confirm no known ComparePage compiler error remains**

The previous `lint_or_type_error` caused by mismatched `Select`/`TabsContent` tags must no longer appear.

### Task 3: Verify GitHub main and deployment source

**Files:**
- Read: `src/pages/ComparePage.tsx`
- Read: GitHub commit metadata

**Interfaces:**
- Consumes: Successful build commit from Task 2.
- Produces: Verified GitHub `main` SHA that is safe to deploy.

- [ ] **Step 1: Confirm the repair is on `main`**

Fetch `src/pages/ComparePage.tsx` from `main` and confirm the corrected nesting is present.

- [ ] **Step 2: Record the new `main` commit SHA**

Use the GitHub commit result from Task 1 as the source of truth for deployment verification.

- [ ] **Step 3: Confirm Vercel is configured to build `main`**

Use the deployment metadata to verify the production deployment source is `main` and belongs to `northghead-cpu/secure-civil-loans`.

### Task 4: Deploy and verify production

**Files:**
- No source-file changes unless a deployment exposes a new concrete build error.

**Interfaces:**
- Consumes: Verified `main` commit from Task 3.
- Produces: A Vercel production deployment in `READY` state serving the verified commit.

- [ ] **Step 1: Trigger production deployment from the corrected project state**

Deploy the Vercel production target only after Task 2 passes.

- [ ] **Step 2: Inspect deployment state**

A deployment object with `PENDING` is not success. Inspect the resulting deployment until its terminal state is known.

- [ ] **Step 3: Require `READY` before reporting success**

Expected: Vercel reports `readyState=READY` and no `lint_or_type_error`/`npm run build exited with 1` failure.

- [ ] **Step 4: Verify deployment commit identity**

Confirm the successful production deployment metadata references the same corrected GitHub `main` SHA from Task 3.

- [ ] **Step 5: Verify the public production domain**

Confirm `riverbanc.co.zm` points at the successful production deployment. Do not substitute a generated `riverbank1` alias for the public domain.

### Task 5: Validate live application identity

**Files:**
- Read: existing HTML metadata/canonical configuration

**Interfaces:**
- Consumes: Successful production deployment from Task 4.
- Produces: Evidence that the public application is serving the corrected Riverbanc build.

- [ ] **Step 1: Verify the live origin**

Open the public production origin `https://riverbanc.co.zm` and confirm it serves the Riverbanc application rather than a stale/error deployment.

- [ ] **Step 2: Verify canonical branding**

Confirm the live page metadata continues to identify Riverbanc and uses `https://riverbanc.co.zm` as canonical where applicable.

- [ ] **Step 3: Verify the repaired application path**

Confirm `/compare` loads from the successful production build and no longer triggers the deployment/build failure caused by the malformed JSX.

- [ ] **Step 4: Record final evidence**

Record the successful build result, Vercel deployment ID/SHA, production status, and public domain verification before reporting completion.

## Domain Configuration Follow-up

Domain normalization is intentionally a separate implementation plan because it changes deployment infrastructure independently of the code repair. After the production build is healthy, inspect Vercel custom domains and aliases, determine exactly why `riverbank1` is present, and change only the safe configuration necessary to keep `riverbanc.co.zm` as the single public production domain.
