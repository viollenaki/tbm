# Bootstraps .env files and starts the full tbm stack.
# Usage: ./start.ps1 [extra docker compose up args, e.g. -d]
$ErrorActionPreference = "Stop"
Push-Location $PSScriptRoot
try {
    & (Join-Path $PSScriptRoot "scripts/init-env.ps1")
    docker compose up --build @args
} finally {
    Pop-Location
}
