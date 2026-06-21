# PowerShell script to kill port 3000 processes and start dev server

Write-Host "Checking for processes on port 3000..." -ForegroundColor Yellow

# Find and kill all processes using port 3000
$processes = netstat -ano | findstr ":3000" | Select-String "LISTENING"

if ($processes) {
    Write-Host "Found processes on port 3000, killing them..." -ForegroundColor Red
    
    foreach ($process in $processes) {
        $parts = $process.ToString().Split(' ', [StringSplitOptions]::RemoveEmptyEntries)
        if ($parts.Length -ge 5) {
            $processId = $parts[-1]
            try {
                Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                Write-Host "Killed process PID: $processId" -ForegroundColor Green
            } catch {
                Write-Host "Failed to kill process PID: $processId" -ForegroundColor Yellow
            }
        }
    }
    
    # Wait a moment for processes to fully terminate
    Start-Sleep -Seconds 2
} else {
    Write-Host "No processes found on port 3000" -ForegroundColor Green
}

# Double check port is clear
$remaining = netstat -ano | findstr ":3000" | Select-String "LISTENING"
if ($remaining) {
    Write-Host "Warning: Port 3000 still in use, trying alternative approach..." -ForegroundColor Yellow
    
    # Try to kill by process name
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# Start the dev server
Write-Host "Starting dev server on port 3000..." -ForegroundColor Cyan
npm run dev
