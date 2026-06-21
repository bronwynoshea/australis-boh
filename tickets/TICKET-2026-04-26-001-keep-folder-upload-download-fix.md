# TICKET-2026-04-26-001: Keep Folder Upload and Download Reliability

## Summary
Keep only supported individual file uploads, so users could not upload an entire local folder while preserving nested folder structure. Keep file downloads were also unreliable from the main file details panel.

## Type
Bug fix

## Status
Fixed locally and pushed to `origin/codex-staging`.

## Commit
`12b60eeaaed213e653f79c25dad089b221901638`

## What Was Wrong
Workspace uploads used a file-only input and did not send `webkitRelativePath` data to the upload flow.

Gold Library submissions accepted a single file only, even though the same backend upload function can route files into Gold Library and preserve the pending review lifecycle.

The main file details panel implemented its own download logic and fetched signed storage URLs as blobs in the browser. That pattern can fail when storage CORS blocks the browser-side fetch, even when the signed URL itself is valid.

## Root Cause
- Folder upload paths were not collected in the frontend.
- The upload Edge Function did not accept or process a safe relative folder path.
- Download behavior was split between a shared hook and custom panel logic.
- Signed download URLs expired after 5 minutes, which was brittle for slower or delayed browser download flows.

## How It Was Fixed

### Workspace Folder Upload
**Files:**
- `src/apps/keep/components/UploadDropzone.tsx`
- `src/apps/keep/hooks/useSupabaseUpload.ts`
- `src/apps/keep/types.ts`

Added separate file and folder pickers. Folder picker uses:
```tsx
input type="file"
multiple
webkitdirectory
directory
```

Each selected file is still uploaded one request at a time. When available, the frontend sends the file's safe `webkitRelativePath` as `relative_path`.

### Gold Library Folder Upload
**File:** `src/apps/keep/components/SubmitToGoldLibraryModal.tsx`

Gold Library submissions now accept multiple files or a selected local folder. The existing destination folder picker remains in place, and uploaded files still enter the Gold Library approval workflow.

### Nested Folder Preservation
**File:** `supabase/functions/keep-upload-file/index.ts`

The upload function now:
- accepts `relative_path`
- rejects unsafe paths such as `../`, absolute paths, and malformed URL-like paths
- normalizes slashes
- creates or reuses nested `keep_folder` records under the selected destination
- keeps one-file-at-a-time upload behavior
- keeps storage bucket routing by area
- keeps Workspace files in `draft`
- keeps Gold Library files in `pending_review`
- keeps version and activity logging behavior

Example:
```text
Selected Keep folder: Operations/Policies
Uploaded local folder: Benefits
Local file: Benefits/2026/pto.pdf
Stored Keep path: Operations/Policies/Benefits/2026/pto.pdf
```

### Download Repair
**Files:**
- `src/apps/keep/components/FileDetailPanel.tsx`
- `src/apps/keep/hooks/useFileDownload.ts`
- `supabase/functions/keep-file-download/index.ts`

The details panel now uses the shared download hook. Downloads use secure signed URLs directly instead of fetching blobs in frontend JavaScript.

The download Edge Function now:
- uses the file record's `storage_bucket`
- uses the file record's `storage_path`
- keeps Gold Library approved-only enforcement
- keeps auth checks
- returns a signed URL with a filename
- extends signed URL expiry to 1 hour

### CORS
**File:** `supabase/functions/_shared/cors.ts`

Added support for BOH Cloudflare Pages preview subdomains matching:
```text
*.boh-ccm.pages.dev
```

This avoids blocking Edge Function calls from branch preview URLs.

### Related Bug Fix
**File:** `supabase/functions/keep-create-folder/index.ts`

Fixed a pre-existing typo where the function referenced `authContext` instead of `keepAuth`.

## Files Changed
1. `src/apps/keep/components/FileDetailPanel.tsx`
2. `src/apps/keep/components/SubmitToGoldLibraryModal.tsx`
3. `src/apps/keep/components/UploadDropzone.tsx`
4. `src/apps/keep/hooks/useFileDownload.ts`
5. `src/apps/keep/hooks/useSupabaseUpload.ts`
6. `src/apps/keep/types.ts`
7. `supabase/functions/_shared/cors.ts`
8. `supabase/functions/keep-create-folder/index.ts`
9. `supabase/functions/keep-file-download/index.ts`
10. `supabase/functions/keep-upload-file/index.ts`

## Verification
- `git diff --check` passed before commit.
- `npm run build` and `npm run typecheck` could not run in the local shell because `npm` and project `node_modules` were unavailable.

## Deployment Notes
No Edge Functions were deployed as part of this ticket. The frontend and function source changes were committed and pushed only.

## Follow-Up Testing
- Upload a single Workspace file into an existing folder.
- Upload a nested Workspace folder into an existing folder and confirm the folder tree is preserved.
- Submit a single Gold Library file and confirm it enters pending review.
- Submit a nested Gold Library folder and confirm files enter pending review under the selected destination.
- Download an approved Workspace file.
- Download an approved Gold Library file.
- Confirm unapproved Gold Library files still cannot be downloaded.
