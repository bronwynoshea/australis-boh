# TICKET-2026-04-26-003: Keep Gold Library Governance Flow

## Type
Enhancement / bug fix

## Status
In progress

## Summary
Gold Library submissions should start from Workspace files, not direct upload from the Gold Library root. Reviewers also need to correct the requested Gold Library destination folder before approval.

## Notes
- Supabase Auth users are used only for authentication.
- Keep ownership, review, and activity records use `boh_user.id`.
- Gold Library folders are loaded from `keep_folder`; folder names must not be hardcoded in the frontend.

## Changes
- Removed the direct Gold Library submit/upload panel from the Gold Library root.
- Added Workspace file submission to Gold Library with a live Gold Library folder picker.
- Added pending Gold Library destination correction in the review queue.
- Added backend support for moving pending Gold Library files between Gold folders.
- Fixed folder uploads so file display names use the uploaded file basename, not the relative folder path.
- Refreshed folders after uploads so newly created nested folders appear without a manual reload.

## Verification
Pending local build/typecheck and dev Edge Function deployment.
