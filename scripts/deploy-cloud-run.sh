#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="${SERVICE_NAME:-atlas-api}"
REGION="${REGION:-europe-west1}"
REPOSITORY="${REPOSITORY:-routemarket-atlas}"
IMAGE_NAME="${IMAGE_NAME:-atlas-api}"
SERVICE_ACCOUNT_NAME="${SERVICE_ACCOUNT_NAME:-atlas-api-runner}"
ENV_FILE="${ENV_FILE:-.env}"
PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"

if [ -z "${PROJECT_ID}" ]; then
  echo "Error: GCP project is not configured. Run: gcloud config set project PROJECT_ID" >&2
  exit 1
fi

if [ ! -f "${ENV_FILE}" ]; then
  echo "Error: env file not found: ${ENV_FILE}" >&2
  exit 1
fi

read_env() {
  local key="$1"
  grep -E "^${key}=" "${ENV_FILE}" | tail -n 1 | cut -d= -f2- || true
}

require_env() {
  local key="$1"
  local value
  value="$(read_env "${key}")"
  if [ -z "${value}" ]; then
    echo "Error: ${key} is required in ${ENV_FILE}" >&2
    exit 1
  fi
  printf "%s" "${value}"
}

env_or_default() {
  local key="$1"
  local fallback="$2"
  local value
  value="$(read_env "${key}")"
  if [ -n "${value}" ]; then
    printf "%s" "${value}"
  else
    printf "%s" "${fallback}"
  fi
}

ensure_secret() {
  local name="$1"
  local value="$2"
  if ! gcloud secrets describe "${name}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
    gcloud secrets create "${name}" --replication-policy automatic --project "${PROJECT_ID}" >/dev/null
  fi
  printf "%s" "${value}" | gcloud secrets versions add "${name}" --data-file=- --project "${PROJECT_ID}" >/dev/null
}

add_secret_env() {
  local env_name="$1"
  local secret_name="$2"
  local value="$3"
  if [ -z "${value}" ]; then
    echo "Skipping empty optional secret ${env_name}."
    return
  fi
  ensure_secret "${secret_name}" "${value}"
  if [ -z "${SECRET_ENV_VARS}" ]; then
    SECRET_ENV_VARS="${env_name}=${secret_name}:latest"
  else
    SECRET_ENV_VARS="${SECRET_ENV_VARS},${env_name}=${secret_name}:latest"
  fi
}

SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${IMAGE_NAME}:latest"
SECRET_ENV_VARS=""

printf "Ensuring APIs, Artifact Registry, service account and secrets...
"
gcloud services enable artifactregistry.googleapis.com cloudbuild.googleapis.com run.googleapis.com secretmanager.googleapis.com --project "${PROJECT_ID}" >/dev/null

if ! gcloud artifacts repositories describe "${REPOSITORY}" --location "${REGION}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${REPOSITORY}"     --repository-format docker     --location "${REGION}"     --description "RouteMarket Atlas container images"     --project "${PROJECT_ID}" >/dev/null
fi

if ! gcloud iam service-accounts describe "${SERVICE_ACCOUNT_EMAIL}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${SERVICE_ACCOUNT_NAME}"     --display-name "RouteMarket Atlas API Runner"     --project "${PROJECT_ID}" >/dev/null
fi

gcloud projects add-iam-policy-binding "${PROJECT_ID}"   --member "serviceAccount:${SERVICE_ACCOUNT_EMAIL}"   --role roles/secretmanager.secretAccessor   --condition=None >/dev/null

add_secret_env ATLAS_API_TOKEN atlas-api-token "$(require_env ATLAS_API_TOKEN)"
add_secret_env SUPABASE_URL atlas-supabase-url "$(require_env SUPABASE_URL)"
add_secret_env SUPABASE_SERVICE_ROLE_KEY atlas-supabase-service-role-key "$(require_env SUPABASE_SERVICE_ROLE_KEY)"
add_secret_env GEMINI_API_KEY atlas-gemini-api-key "$(read_env GEMINI_API_KEY)"
add_secret_env GOOGLE_API_KEY atlas-google-api-key "$(read_env GOOGLE_API_KEY)"
add_secret_env GOOGLE_MAPS_API_KEY atlas-google-maps-api-key "$(read_env GOOGLE_MAPS_API_KEY)"
add_secret_env GRAPHHOPPER_API_KEY atlas-graphhopper-api-key "$(read_env GRAPHHOPPER_API_KEY)"

printf "Building image %s...
" "${IMAGE_URI}"
gcloud builds submit --tag "${IMAGE_URI}" --project "${PROJECT_ID}"

printf "Deploying %s to Cloud Run...
" "${SERVICE_NAME}"
DEPLOY_ARGS=(
  run deploy "${SERVICE_NAME}"
  --project "${PROJECT_ID}"
  --image "${IMAGE_URI}"
  --region "${REGION}"
  --platform managed
  --allow-unauthenticated
  --service-account "${SERVICE_ACCOUNT_EMAIL}"
  --memory "${MEMORY:-2Gi}"
  --cpu "${CPU:-1}"
  --min-instances "${MIN_INSTANCES:-0}"
  --max-instances "${MAX_INSTANCES:-10}"
  --set-env-vars "^@^NODE_ENV=production@ATLAS_ROOT_DIR=/tmp/atlas@ATLAS_LOG_REQUESTS=true@ATLAS_MAX_JOBS=$(env_or_default ATLAS_MAX_JOBS 200)@ATLAS_CORS_ORIGIN=$(env_or_default ATLAS_CORS_ORIGIN https://routemarket.io)@GEMINI_MODEL=$(env_or_default GEMINI_MODEL gemini-2.5-flash)"
)

if [ -n "${SECRET_ENV_VARS}" ]; then
  DEPLOY_ARGS+=(--set-secrets "${SECRET_ENV_VARS}")
fi

gcloud "${DEPLOY_ARGS[@]}"

SERVICE_URL="$(gcloud run services describe "${SERVICE_NAME}" --project "${PROJECT_ID}" --region "${REGION}" --format='value(status.url)')"
printf "Deployment complete: %s
" "${SERVICE_URL}"
printf "Health: "
curl -fsS "${SERVICE_URL}/health" >/dev/null && printf "ok
"
