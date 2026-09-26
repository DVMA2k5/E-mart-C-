$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$tempDir = Join-Path $repoRoot ".tmp"
$dotnetHome = Join-Path $repoRoot ".dotnet-home"
$nugetCache = Join-Path $repoRoot ".nuget-cache"
$backendDir = Join-Path $repoRoot "backend"

New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
New-Item -ItemType Directory -Force -Path $dotnetHome | Out-Null
New-Item -ItemType Directory -Force -Path $nugetCache | Out-Null

$env:TEMP = $tempDir
$env:TMP = $tempDir
$env:DOTNET_CLI_HOME = $dotnetHome
$env:DOTNET_SKIP_FIRST_TIME_EXPERIENCE = "1"
$env:DOTNET_NOLOGO = "1"
$env:DOTNET_ADD_GLOBAL_TOOLS_TO_PATH = "0"
$env:NUGET_HTTP_CACHE_PATH = $nugetCache

Set-Location $backendDir
dotnet run --no-restore
