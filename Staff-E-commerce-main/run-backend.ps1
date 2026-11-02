$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$tempDir = Join-Path $projectRoot ".tmp"
$backendProject = Join-Path $projectRoot "backend\backend.csproj"
$backendExecutable = Join-Path $projectRoot "backend\bin\Debug\net9.0\backend.exe"

# Dừng bản backend của chính project này trước khi build để Windows không khóa
# backend.exe. Chỉ khớp đường dẫn project/executable hiện tại, không dừng các
# tiến trình dotnet của Visual Studio Code hay project khác.
$existingBackendProcesses = Get-CimInstance Win32_Process | Where-Object {
    ($_.Name -ieq "backend.exe" -and $_.ExecutablePath -ieq $backendExecutable) -or
    ($_.Name -ieq "dotnet.exe" -and $_.CommandLine -like "*$backendProject*")
}

foreach ($process in $existingBackendProcesses) {
    Write-Host "Stopping existing backend process $($process.ProcessId)..."
    Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
}

if ($existingBackendProcesses) {
    Start-Sleep -Milliseconds 500
}

New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

$env:TEMP = $tempDir
$env:TMP = $tempDir

dotnet run --project $backendProject --no-restore
