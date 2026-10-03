#!/usr/bin/env bash
set -euo pipefail

SERVICE="${1:-all}"
PROJECT="${PROJECT:-eco-charge-kg}"
REGION="${REGION:-europe-west1}"
INSTANCE="${INSTANCE:-tbm-db}"
DB_NAME="${DB_NAME:-tbm_vouchers}"
DB_USER="${DB_USER:-postgres}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "================================================="
echo "  TBM Voucher Service - Cloud Run Deployment    "
echo "================================================="

if ! command -v gcloud &> /dev/null; then
    echo "Error: gcloud CLI is not installed or not in PATH."
    exit 1
fi

# Load .env.production if exists
if [ -f "${ROOT_DIR}/.env.production" ]; then
    export $(grep -v '^#' "${ROOT_DIR}/.env.production" | xargs -d '\n')
fi

if [ -z "${POSTGRES_PASSWORD:-}" ]; then
    echo "Error: POSTGRES_PASSWORD is not set in environment or in .env.production."
    echo "Please configure POSTGRES_PASSWORD in .env.production before running deploy."
    exit 1
fi
DB_PASSWORD="${POSTGRES_PASSWORD}"

echo "[1/5] Target Project: ${PROJECT} (Region: ${REGION})"

# Check Cloud SQL
echo "[2/5] Checking Cloud SQL instance ${INSTANCE}..."
SQL_STATUS=$(gcloud sql instances describe "${INSTANCE}" --project="${PROJECT}" --format="value(state)" 2>/dev/null || echo "NOT_FOUND")
while [ "${SQL_STATUS}" != "RUNNABLE" ]; do
    echo "  Waiting for Cloud SQL instance ${INSTANCE} to become RUNNABLE (current: ${SQL_STATUS})..."
    sleep 15
    SQL_STATUS=$(gcloud sql instances describe "${INSTANCE}" --project="${PROJECT}" --format="value(state)" 2>/dev/null || echo "NOT_FOUND")
done
echo "Cloud SQL instance ${INSTANCE} is RUNNABLE!"

# Ensure database exists
EXISTING_DBS=$(gcloud sql databases list --instance="${INSTANCE}" --project="${PROJECT}" --format="value(name)" 2>/dev/null || true)
if ! echo "${EXISTING_DBS}" | grep -q "^${DB_NAME}$"; then
    echo "Creating database ${DB_NAME}..."
    gcloud sql databases create "${DB_NAME}" --instance="${INSTANCE}" --project="${PROJECT}" --quiet
    echo "Database ${DB_NAME} created."
else
    echo "Database ${DB_NAME} already exists."
fi

INSTANCE_CONN="${PROJECT}:${REGION}:${INSTANCE}"
DATABASE_URL="postgres://${DB_USER}:${DB_PASSWORD}@localhost/${DB_NAME}?host=/cloudsql/${INSTANCE_CONN}"

BACKEND_URL=""
if [ "${SERVICE}" = "all" ] || [ "${SERVICE}" = "backend" ]; then
    echo ""
    echo "[3/5] Building and Deploying tbm-backend..."
    gcloud builds submit "${ROOT_DIR}/backend" \
        --project="${PROJECT}" \
        --tag="gcr.io/${PROJECT}/tbm-backend:latest" \
        --quiet

    gcloud run deploy tbm-backend \
        --image="gcr.io/${PROJECT}/tbm-backend:latest" \
        --project="${PROJECT}" \
        --region="${REGION}" \
        --platform=managed \
        --allow-unauthenticated \
        --port=8080 \
        --memory=512Mi \
        --cpu=1 \
        --min-instances=0 \
        --max-instances=10 \
        --add-cloudsql-instances="${INSTANCE_CONN}" \
        --set-env-vars="DATABASE_URL=${DATABASE_URL},HOST=0.0.0.0,RUST_LOG=info,backend=debug,RATE_LIMIT_ENABLED=true,RATE_LIMIT_PER_MINUTE=60,RATE_LIMIT_BURST=30" \
        --quiet

    BACKEND_URL=$(gcloud run services describe tbm-backend --project="${PROJECT}" --region="${REGION}" --format="value(status.url)")
    echo "tbm-backend is live at: ${BACKEND_URL}"
else
    BACKEND_URL=$(gcloud run services describe tbm-backend --project="${PROJECT}" --region="${REGION}" --format="value(status.url)" 2>/dev/null || true)
fi

FRONTEND_URL=""
if [ "${SERVICE}" = "all" ] || [ "${SERVICE}" = "frontend" ]; then
    echo ""
    echo "[4/5] Building and Deploying tbm-frontend..."
    if [ -z "${BACKEND_URL}" ]; then
        BACKEND_URL=$(gcloud run services describe tbm-backend --project="${PROJECT}" --region="${REGION}" --format="value(status.url)")
    fi

    gcloud builds submit "${ROOT_DIR}/frontend" \
        --project="${PROJECT}" \
        --config="${SCRIPT_DIR}/cloudbuild-frontend.yaml" \
        --substitutions="_API_URL=${BACKEND_URL}" \
        --quiet

    gcloud run deploy tbm-frontend \
        --image="gcr.io/${PROJECT}/tbm-frontend:latest" \
        --project="${PROJECT}" \
        --region="${REGION}" \
        --platform=managed \
        --allow-unauthenticated \
        --port=80 \
        --memory=256Mi \
        --cpu=1 \
        --min-instances=0 \
        --max-instances=10 \
        --quiet

    FRONTEND_URL=$(gcloud run services describe tbm-frontend --project="${PROJECT}" --region="${REGION}" --format="value(status.url)")
    echo "tbm-frontend is live at: ${FRONTEND_URL}"
fi

echo ""
echo "================================================="
echo "  Deployment Completed Successfully!            "
echo "================================================="
[ -n "${BACKEND_URL}" ] && echo "  Backend API:      ${BACKEND_URL}"
[ -n "${BACKEND_URL}" ] && echo "  Swagger UI:       ${BACKEND_URL}/swagger-ui"
[ -n "${FRONTEND_URL}" ] && echo "  User Portal:      ${FRONTEND_URL}"
[ -n "${FRONTEND_URL}" ] && echo "  Admin Panel:      ${FRONTEND_URL}/admin"
echo "================================================="
