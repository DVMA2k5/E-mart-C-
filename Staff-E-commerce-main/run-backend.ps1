$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$tempDir = Join-Path $projectRoot ".tmp"
$backendProject = Join-Path $projectRoot "backend\backend.csproj"

New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

$env:TEMP = $tempDir
$env:TMP = $tempDir

dotnet run --project $backendProject --no-restore
