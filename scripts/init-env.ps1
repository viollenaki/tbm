# Creates missing .env files (root, backend, frontend) from their .env.example templates.
# Existing .env files are never overwritten.
$ErrorActionPreference = "Stop"
$RootDir = Resolve-Path (Join-Path $PSScriptRoot "..")

foreach ($dir in @($RootDir, (Join-Path $RootDir "backend"), (Join-Path $RootDir "frontend"))) {
    $envFile = Join-Path $dir ".env"
    $example = Join-Path $dir ".env.example"
    if (-not (Test-Path $envFile) -and (Test-Path $example)) {
        Copy-Item $example $envFile
        Write-Host "Created $envFile from .env.example"
    }
}
