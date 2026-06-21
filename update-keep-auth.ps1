# PowerShell script to update all Keep Edge functions to use new auth pattern
# This replaces getAuthContext with getKeepAuthContext

$functionsToUpdate = @(
    "keep-upload-file",
    "keep-upload",
    "keep-sections",
    "keep-quick-link-admin",
    "keep-list",
    "keep-folders",
    "keep-folder-by-id",
    "keep-files",
    "keep-file-versions",
    "keep-file-approval",
    "keep-download",
    "keep-create-folder"
)

$basePath = "c:\1. DEVELOPMENT ENVIRONMENT\boh\supabase\functions"

foreach ($func in $functionsToUpdate) {
    $filePath = Join-Path $basePath "$func\index.ts"
    
    if (Test-Path $filePath) {
        Write-Host "Updating $func..." -ForegroundColor Cyan
        
        $content = Get-Content $filePath -Raw
        
        # Replace import statement
        $content = $content -replace 'import \{ getAuthContext(.*?) \} from "\.\./_shared/keep-auth\.ts";', 'import { getKeepAuthContext$1 } from "../_shared/keep-auth-new.ts";'
        
        # Replace function calls and update variable names
        $content = $content -replace 'const authContext = await getAuthContext\(req\);', 'const keepAuth = await getKeepAuthContext(req);'
        $content = $content -replace 'if \(!authContext\)', 'if (!keepAuth)'
        
        # Update references to authContext properties
        $content = $content -replace 'authContext\.bohUser', 'keepAuth.bohUser'
        $content = $content -replace 'authContext\.isSuperAdmin', 'keepAuth.isSuperAdmin'
        $content = $content -replace 'authContext\.authUser', 'keepAuth.authUser'
        
        # Update admin client creation - replace with keepAuth.serviceClient
        $content = $content -replace 'const supabaseUrl = Deno\.env\.get\("SUPABASE_URL"\);\s+const secretKey = Deno\.env\.get\("SB_SECRET_KEY"\);\s+if \(!supabaseUrl \|\| !secretKey\) \{[^}]+\}\s+const (adminClient|serviceClient) = createClient\(supabaseUrl, secretKey, \{\s+auth: \{ persistSession: false \},\s+\}\);', 'const $1 = keepAuth.serviceClient;'
        
        # Write updated content
        Set-Content $filePath $content -NoNewline
        
        Write-Host "  ✓ Updated $func" -ForegroundColor Green
    } else {
        Write-Host "  ✗ File not found: $filePath" -ForegroundColor Red
    }
}

Write-Host "`nAll Keep Edge functions updated!" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Review changes in each function" -ForegroundColor Yellow
Write-Host "2. Deploy all functions: npx supabase functions deploy" -ForegroundColor Yellow
