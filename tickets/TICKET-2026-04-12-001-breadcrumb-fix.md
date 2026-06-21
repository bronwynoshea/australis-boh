# TICKET-2026-04-12-001: Keep Breadcrumb Shows Incomplete Path

## Summary
Breadcrumbs in Keep file browser were missing intermediate folder segments, showing only root and current folder instead of the full hierarchy.

## What Was Wrong
**Example:** Navigating to "Pitch Decks" folder inside "Executive" showed:
```
Workspace > Pitch Decks
```
**Should show:**
```
Workspace > Executive > Pitch Decks
```

The breadcrumb logic only knew about the root folder and current folder, not the ancestor chain in between.

## Root Cause
`KeepBrowserPage.tsx` breadcrumbs were built from `childFolders` (sibling folders at current level), which only contains folders sharing the same parent. The code had no way to traverse up the parent chain to find intermediate folders like "Executive".

**Code at fault:**
```typescript
// src/apps/keep/pages/KeepBrowserPage.tsx:143-156
useEffect(() => {
  if (isRootLevel) {
    setBreadcrumbs([{ id: 'root', name: areaLabel, folderId: null }]);
  } else if (folderId && childFolders.length > 0) {
    const current = childFolders.find(f => f.id === folderId);
    if (current) {
      setBreadcrumbs([
        { id: 'root', name: areaLabel, folderId: null },
        { id: folderId, name: current.name, folderId: folderId },  // Missing ancestors!
      ]);
    }
  }
}, [folderId, isRootLevel, areaLabel, childFolders]);
```

## How It Was Fixed

### 1. New Hook: `useFolderAncestors`
**File:** `src/apps/keep/hooks/useFolderAncestors.ts`

Walks up the `parent_id` chain by calling a new edge function for each ancestor:
```typescript
while (currentId) {
  const { data } = await supabase.functions.invoke(`keep-folder-by-id?folder_id=${currentId}`);
  ancestorChain.unshift(data.folder);
  currentId = data.folder.parent_id;  // Walk up to next parent
}
```

### 2. New Edge Function: `keep-folder-by-id`
**File:** `supabase/functions/keep-folder-by-id/index.ts`
**Config:** `supabase/config.toml:123-124` added with `verify_jwt = false`

Returns a single folder by ID. Uses Pattern B auth (manual JWT validation via `getAuthContext`), matching other Keep functions.

### 3. Updated Breadcrumb Logic
**File:** `src/apps/keep/pages/KeepBrowserPage.tsx:47-48,150-172`

Uses `useFolderAncestors` to build complete breadcrumb chain:
```typescript
const { ancestors: folderAncestors } = useFolderAncestors(folderId);

useEffect(() => {
  const breadcrumbItems = [{ id: 'root', name: areaLabel, folderId: null }];
  
  folderAncestors.forEach((ancestor) => {
    if (!ancestor.is_system_folder) {  // Skip "Workspace" system folder
      breadcrumbItems.push({
        id: ancestor.id,
        name: ancestor.name,
        folderId: ancestor.id,
      });
    }
  });
  
  setBreadcrumbs(breadcrumbItems);
}, [folderId, isRootLevel, areaLabel, folderAncestors]);
```

## Deployment
- Edge function `keep-folder-by-id` deployed to production
- Config updated with `verify_jwt = false` for Pattern B auth

## Files Changed
1. `src/apps/keep/hooks/useFolderAncestors.ts` - NEW
2. `supabase/functions/keep-folder-by-id/index.ts` - NEW
3. `supabase/config.toml` - Added function config
4. `src/apps/keep/pages/KeepBrowserPage.tsx` - Updated breadcrumb logic

## Verification
Navigate to a nested folder (e.g., Workspace > Executive > Pitch Decks) and confirm breadcrumb shows all three segments.
