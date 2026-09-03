# ============================================================
# CLEAR ALL UPLOAD HISTORY AND SYSTEM CACHES - PowerShell Script
# ============================================================
# Purpose: Clean all upload tracking files and logs from backend
# Location: c:\Magic\SomaLux\backend\
# ============================================================

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host "Starting cache and upload history clearance from: $scriptPath" -ForegroundColor Cyan

# ============================================================
# SECTION 1: CLEAR UPLOAD TRACKING JSON FILES
# ============================================================

Write-Host "`nClearing upload tracking files..." -ForegroundColor Yellow

# Clear upload-progress.json
$progressFile = Join-Path $scriptPath "upload-progress.json"
if (Test-Path $progressFile) {
    try {
        @{
            completed = @()
            failed = @()
        } | ConvertTo-Json | Set-Content $progressFile -Encoding UTF8 -Force
        Write-Host "[OK] Cleared upload-progress.json" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Failed to clear upload-progress.json`: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "[WARN] upload-progress.json not found" -ForegroundColor Yellow
}

# Clear upload-processes.json
$processesFile = Join-Path $scriptPath "upload-processes.json"
if (Test-Path $processesFile) {
    try {
        @{} | ConvertTo-Json | Set-Content $processesFile -Encoding UTF8 -Force
        Write-Host "[OK] Cleared upload-processes.json" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Failed to clear upload-processes.json`: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "[WARN] upload-processes.json not found" -ForegroundColor Yellow
}

# ============================================================
# SECTION 2: CLEAR LOG FILES
# ============================================================

Write-Host "`nClearing log files..." -ForegroundColor Yellow

$logFiles = @(
    "upload-errors.log",
    "bulk-upload-errors.log",
    "backend.log",
    "error.log",
    "live.log",
    "test-output.txt"
)

foreach ($logFile in $logFiles) {
    $filePath = Join-Path $scriptPath $logFile
    if (Test-Path $filePath) {
        try {
            Clear-Content $filePath -Force
            Write-Host "[OK] Cleared $logFile" -ForegroundColor Green
        } catch {
            Write-Host "[ERROR] Failed to clear $logFile`: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

# ============================================================
# SECTION 3: VERIFY CLEANUP
# ============================================================

Write-Host "`nVerification Summary:" -ForegroundColor Cyan

Write-Host "`nFile Status:" -ForegroundColor Yellow
if (Test-Path $progressFile) {
    Write-Host "  [OK] upload-progress.json exists (cleared)" -ForegroundColor Green
} else {
    Write-Host "  [WARN] upload-progress.json not found" -ForegroundColor Yellow
}

if (Test-Path $processesFile) {
    Write-Host "  [OK] upload-processes.json exists (cleared)" -ForegroundColor Green
} else {
    Write-Host "  [WARN] upload-processes.json not found" -ForegroundColor Yellow
}

# ============================================================
# SECTION 4: DISPLAY NEXT STEPS
# ============================================================

Write-Host "`nNEXT STEPS TO COMPLETE FULL CLEANUP:" -ForegroundColor Cyan
Write-Host "
1. SQL Database Cleanup:
   - Open Supabase dashboard
   - Run SQL from: CLEAR_ALL_UPLOADS_AND_CACHES.sql
   - This clears database upload tracking

2. Browser Cache Cleanup:
   - Open browser and press F12
   - Go to Console tab
   - Copy JavaScript from CLEAR_ALL_UPLOADS_AND_CACHES.sql
   - Paste and press Enter

3. Restart Services:
   - Restart backend server
   - Hard refresh browser (Ctrl+Shift+Delete)

4. Verification:
   - Check upload history is empty in admin
   - Verify caches load fresh data
" -ForegroundColor Cyan

Write-Host "`n[OK] Backend file cleanup COMPLETE!" -ForegroundColor Green
Write-Host "Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
