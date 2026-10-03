#!/usr/bin/env bash
set -e

PROJECT="${PROJECT:-eco-charge-kg}"
REGION="${REGION:-europe-west1}"
INSTANCE="${INSTANCE:-tbm-db}"

echo "================================================="
echo "  TBM Voucher Service - GCP Resources Cleanup    "
echo "================================================="

echo "Deleting Cloud Run service 'tbm-frontend'..."
gcloud run services delete tbm-frontend --region="${REGION}" --project="${PROJECT}" --quiet || true

echo "Deleting Cloud Run service 'tbm-backend'..."
gcloud run services delete tbm-backend --region="${REGION}" --project="${PROJECT}" --quiet || true

echo "Deleting Cloud SQL instance '${INSTANCE}'..."
gcloud sql instances delete "${INSTANCE}" --project="${PROJECT}" --quiet || true

echo "Deleting Docker images..."
gcloud container images delete "gcr.io/${PROJECT}/tbm-frontend" --force-delete-tags --quiet || true
gcloud container images delete "gcr.io/${PROJECT}/tbm-backend" --force-delete-tags --quiet || true

echo ""
echo "All TBM resources have been cleaned up from GCP project ${PROJECT}."
