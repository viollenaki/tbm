param (
    [string]$Project = "eco-charge-kg",
    [string]$Region = "europe-west1",
    [string]$Instance = "tbm-db"
)

Write-Host "=================================================" -ForegroundColor Red
Write-Host "  TBM Voucher Service - GCP Resources Cleanup    " -ForegroundColor Red
Write-Host "=================================================" -ForegroundColor Red

# 1. Delete Cloud Run Frontend
Write-Host "Deleting Cloud Run service 'tbm-frontend'..." -ForegroundColor Yellow
gcloud run services delete tbm-frontend --region=$Region --project=$Project --quiet 2>$null
Write-Host "  tbm-frontend deleted or does not exist." -ForegroundColor Green

# 2. Delete Cloud Run Backend
Write-Host "Deleting Cloud Run service 'tbm-backend'..." -ForegroundColor Yellow
gcloud run services delete tbm-backend --region=$Region --project=$Project --quiet 2>$null
Write-Host "  tbm-backend deleted or does not exist." -ForegroundColor Green

# 3. Delete Cloud SQL instance
Write-Host "Deleting Cloud SQL instance '$Instance'..." -ForegroundColor Yellow
gcloud sql instances delete $Instance --project=$Project --quiet 2>$null
Write-Host "  $Instance deleted or does not exist." -ForegroundColor Green

# 4. Delete Docker Images from Container Registry
Write-Host "Deleting Docker images..." -ForegroundColor Yellow
gcloud container images delete "gcr.io/$Project/tbm-frontend" --force-delete-tags --quiet 2>$null
gcloud container images delete "gcr.io/$Project/tbm-backend" --force-delete-tags --quiet 2>$null
Write-Host "  Images deleted." -ForegroundColor Green

Write-Host "`nAll TBM resources have been cleaned up from GCP project $Project." -ForegroundColor Green
