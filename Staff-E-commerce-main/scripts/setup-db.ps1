param(
    [string]$Server = "",
    [string]$DatabaseScript = "..\backend\Data\store_management_full.sql",
    [switch]$SeedDemoData
)

$ErrorActionPreference = "Stop"
$baseDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$databaseScriptPath = [System.IO.Path]::GetFullPath((Join-Path $baseDir $DatabaseScript))
if (-not (Test-Path -LiteralPath $databaseScriptPath)) {
    throw "SQL script not found: $databaseScriptPath"
}

if ([string]::IsNullOrWhiteSpace($Server)) {
    foreach ($candidate in @('localhost', 'localhost\SQLEXPRESS', '.')) {
        $probe = [System.Data.SqlClient.SqlConnection]::new("Server=$candidate;Database=master;Integrated Security=True;TrustServerCertificate=True;Encrypt=False;Connect Timeout=2")
        try {
            $probe.Open()
            $Server = $candidate
            break
        } catch {
            # Try the next local instance.
        } finally {
            $probe.Dispose()
        }
    }
    if ([string]::IsNullOrWhiteSpace($Server)) { throw "No local SQL Server found. Specify -Server." }
}

Write-Host "Applying canonical schema to SQL Server: $Server"
$connection = [System.Data.SqlClient.SqlConnection]::new("Server=$Server;Database=master;Integrated Security=True;TrustServerCertificate=True;Encrypt=False;")
try {
    $connection.Open()
    if ($SeedDemoData) {
        $seedCommand = $connection.CreateCommand()
        try {
            $seedCommand.CommandText = "EXEC sys.sp_set_session_context @key=N'emart_seed_demo', @value=1;"
            [void]$seedCommand.ExecuteNonQuery()
        } finally { $seedCommand.Dispose() }
    }
    $scriptText = Get-Content -LiteralPath $databaseScriptPath -Raw -Encoding UTF8
    foreach ($batch in [regex]::Split($scriptText, '(?im)^\s*GO\s*;?\s*$')) {
        if ([string]::IsNullOrWhiteSpace($batch)) { continue }
        $command = $connection.CreateCommand()
        try {
            $command.CommandTimeout = 120
            $command.CommandText = $batch
            [void]$command.ExecuteNonQuery()
        } finally { $command.Dispose() }
    }
} catch {
    if ($connection.State -eq [System.Data.ConnectionState]::Open) {
        $rollback = $connection.CreateCommand()
        try {
            $rollback.CommandText = 'IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;'
            [void]$rollback.ExecuteNonQuery()
        } finally { $rollback.Dispose() }
    }
    throw
} finally {
    $connection.Dispose()
}

Write-Host "Database schema is up to date. Existing business data was preserved."
if ($SeedDemoData) { Write-Host "Demo login: admin / admin123" }
