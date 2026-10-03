param (
    [string]$Service = "all",
    [string]$Project = "eco-charge-kg",
    [string]$Region = "europe-west1",
    [string]$Instance = "tbm-db",
    [string]$DbName = "tbm_vouchers",
    [string]$DbUser = "postgres"
)

$ErrorActionPreference = "Stop"

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  TBM Voucher Service - Cloud Run Deployment    " -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

# Check gcloud
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Error "Google Cloud SDK (gcloud) is not installed or not in PATH."
}

# Load credentials from .env.production if present
$envProd = Join-Path $PSScriptRoot "..\.env.production"
if (Test-Path $envProd) {
    Get-Content $envProd | Where-Object { $_ -match "^[^#].+=.+" } | ForEach-Object {
        $parts = $_.Split("=", 2)
        [System.Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), "Process")
    }
}

$dbPassword = $env:POSTGRES_PASSWORD
if (-not $dbPassword) {
    Write-Error "POSTGRES_PASSWORD is not set. Please provide it in .env.production or as an environment variable."
}

Write-Host "[1/5] Target Project: $Project (Region: $Region)" -ForegroundColor Green

# 1. Cloud SQL check
Write-Host "[2/5] Checking Cloud SQL instance $Instance..." -ForegroundColor Yellow
$sqlStatus = gcloud sql instances describe $Instance --project=$Project --format="value(state)" 2>$null
if ($sqlStatus -ne "RUNNABLE") {
    Write-Host "Cloud SQL instance $Instance is in state: '$sqlStatus'. Waiting for it to become RUNNABLE..." -ForegroundColor Yellow
    while ($true) {
        Start-Sleep -Seconds 15
        $sqlStatus = gcloud sql instances describe $Instance --project=$Project --format="value(state)" 2>$null
        if ($sqlStatus -eq "RUNNABLE") { break }
        Write-Host "  Waiting for $Instance (current: $sqlStatus)..." -ForegroundColor Gray
    }
}
Write-Host "Cloud SQL $Instance is RUNNABLE!" -ForegroundColor Green

# Create database if missing
$existingDbs = gcloud sql databases list --instance=$Instance --project=$Project --format="value(name)" 2>$null
if ($existingDbs -notcontains $DbName) {
    Write-Host "Creating database '$DbName' in instance $Instance..." -ForegroundColor Yellow
    gcloud sql databases create $DbName --instance=$Instance --project=$Project --quiet
    Write-Host "Database '$DbName' created." -ForegroundColor Green
} else {
    Write-Host "Database '$DbName' already exists." -ForegroundColor Green
}

$instanceConn = "$Project`:$Region`:$Instance"
$databaseUrl = "postgres://${DbUser}:${dbPassword}@localhost/${DbName}?host=/cloudsql/${instanceConn}"

# 2. Deploy Backend
$backendUrl = ""
if ($Service -eq "all" -or $Service -eq "backend") {
    Write-Host "`n[3/5] Building and Deploying tbm-backend to Cloud Run..." -ForegroundColor Cyan

    $backendDir = Resolve-Path (Join-Path $PSScriptRoot "..\backend")
    Write-Host "Submitting Cloud Build for backend container..." -ForegroundColor Yellow
    gcloud builds submit "$backendDir" `
        --project=$Project `
        --tag="gcr.io/$Project/tbm-backend:latest" `
        --quiet

    Write-Host "Deploying tbm-backend Cloud Run service..." -ForegroundColor Yellow
    gcloud run deploy tbm-backend `
        --image="gcr.io/$Project/tbm-backend:latest" `
        --project=$Project `
        --region=$Region `
        --platform=managed `
        --allow-unauthenticated `
        --port=8080 `
        --memory=512Mi `
        --cpu=1 `
        --min-instances=0 `
        --max-instances=10 `
        --add-cloudsql-instances=$instanceConn `
        --set-env-vars="DATABASE_URL=$databaseUrl,HOST=0.0.0.0,RUST_LOG=info,backend=debug,RATE_LIMIT_ENABLED=true,RATE_LIMIT_PER_MINUTE=60,RATE_LIMIT_BURST=30" `
        --quiet

    $backendUrl = gcloud run services describe tbm-backend --project=$Project --region=$Region --format="value(status.url)"
    Write-Host "tbm-backend is live at: $backendUrl" -ForegroundColor Green
} else {
    $backendUrl = gcloud run services describe tbm-backend --project=$Project --region=$Region --format="value(status.url)" 2>$null
}

# 3. Deploy Frontend
$frontendUrl = ""
if ($Service -eq "all" -or $Service -eq "frontend") {
    Write-Host "`n[4/5] Building and Deploying tbm-frontend to Cloud Run..." -ForegroundColor Cyan

    if (-not $backendUrl) {
        $backendUrl = gcloud run services describe tbm-backend --project=$Project --region=$Region --format="value(status.url)" 2>$null
    }
    Write-Host "Frontend configured with backend API: $backendUrl" -ForegroundColor Gray

    $frontendDir = Resolve-Path (Join-Path $PSScriptRoot "..\frontend")
    $cbConfig = Resolve-Path (Join-Path $PSScriptRoot "cloudbuild-frontend.yaml")

    Write-Host "Submitting Cloud Build for frontend container..." -ForegroundColor Yellow
    gcloud builds submit "$frontendDir" `
        --project=$Project `
        --config="$cbConfig" `
        --substitutions="_API_URL=$backendUrl" `
        --quiet

    Write-Host "Deploying tbm-frontend Cloud Run service..." -ForegroundColor Yellow
    gcloud run deploy tbm-frontend `
        --image="gcr.io/$Project/tbm-frontend:latest" `
        --project=$Project `
        --region=$Region `
        --platform=managed `
        --allow-unauthenticated `
        --port=80 `
        --memory=256Mi `
        --cpu=1 `
        --min-instances=0 `
        --max-instances=10 `
        --quiet

    $frontendUrl = gcloud run services describe tbm-frontend --project=$Project --region=$Region --format="value(status.url)"
    Write-Host "tbm-frontend is live at: $frontendUrl" -ForegroundColor Green
}

# Update .env.production with live URLs
if (Test-Path $envProd) {
    $content = Get-Content $envProd -Raw
    if ($backendUrl) {
        $content = [regex]::Replace($content, "BACKEND_URL=.*", "BACKEND_URL=$backendUrl")
    }
    if ($frontendUrl) {
        $content = [regex]::Replace($content, "FRONTEND_URL=.*", "FRONTEND_URL=$frontendUrl")
    }
    Set-Content $envProd $content
}

# 4. Summary Output
Write-Host "`n=================================================" -ForegroundColor Green
Write-Host "  Deployment Completed Successfully!            " -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green
if ($backendUrl) {
    Write-Host "  Backend API:      $backendUrl" -ForegroundColor Cyan
    Write-Host "  Swagger UI:       $backendUrl/swagger-ui" -ForegroundColor Cyan
    Write-Host "  Health Check:     $backendUrl/health" -ForegroundColor Cyan
}
if ($frontendUrl) {
    Write-Host "  User Portal:      $frontendUrl" -ForegroundColor Cyan
    Write-Host "  Admin Panel:      $frontendUrl/admin" -ForegroundColor Cyan
}
Write-Host "=================================================" -ForegroundColor Green
