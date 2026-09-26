param(
    [string]$Server = "localhost\SQLEXPRESS",
    [string]$DatabaseScript = "..\backend\Data\store_management_full.sql",
    [string]$GrantScript = "..\backend\Data\grant_windows_user_access.sql"
)

$ErrorActionPreference = "Stop"

function Invoke-SqlBatches {
    param(
        [string]$ConnectionString,
        [string]$ScriptPath
    )

    if (-not (Test-Path -LiteralPath $ScriptPath)) {
        throw "SQL script not found: $ScriptPath"
    }

    $scriptText = Get-Content -LiteralPath $ScriptPath -Raw -Encoding UTF8
    $batches = [regex]::Split($scriptText, "(?im)^\s*GO\s*;?\s*$")

    $connection = [System.Data.SqlClient.SqlConnection]::new($ConnectionString)
    $connection.Open()

    try {
        foreach ($batch in $batches) {
            if ([string]::IsNullOrWhiteSpace($batch)) {
                continue
            }

            $command = $connection.CreateCommand()
            $command.CommandTimeout = 120
            $command.CommandText = $batch
            [void]$command.ExecuteNonQuery()
        }
    }
    finally {
        $connection.Close()
    }
}

$baseDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$databaseScriptPath = Join-Path $baseDir $DatabaseScript
$grantScriptPath = Join-Path $baseDir $GrantScript
$connectionString = "Server=$Server;Database=master;Integrated Security=True;TrustServerCertificate=True;Encrypt=False;"

Write-Host "Importing database script..."
Invoke-SqlBatches -ConnectionString $connectionString -ScriptPath $databaseScriptPath

Write-Host "Granting Windows user access..."
Invoke-SqlBatches -ConnectionString $connectionString -ScriptPath $grantScriptPath

Write-Host "Done. Login with admin / admin123."
