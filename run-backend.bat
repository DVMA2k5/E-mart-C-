@echo off
setlocal

set "REPO_ROOT=%~dp0Staff-E-commerce-main"
set "TEMP=%REPO_ROOT%\.tmp"
set "TMP=%REPO_ROOT%\.tmp"
set "DOTNET_CLI_HOME=%REPO_ROOT%\.dotnet-home"
set "DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1"
set "DOTNET_NOLOGO=1"
set "DOTNET_ADD_GLOBAL_TOOLS_TO_PATH=0"
set "NUGET_HTTP_CACHE_PATH=%REPO_ROOT%\.nuget-cache"

if not exist "%TEMP%" mkdir "%TEMP%"
if not exist "%DOTNET_CLI_HOME%" mkdir "%DOTNET_CLI_HOME%"
if not exist "%NUGET_HTTP_CACHE_PATH%" mkdir "%NUGET_HTTP_CACHE_PATH%"

cd /d "%REPO_ROOT%\backend"
dotnet run --no-restore
