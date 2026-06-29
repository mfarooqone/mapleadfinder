#!/usr/bin/env bash
# Run on a fresh Ubuntu 24.04 VPS as root.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/lead-outreach-platform}"
ENV_FILE="${APP_DIR}/deploy/.env"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}"
  echo "Copy deploy/.env.example to deploy/.env and set passwords first."
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

if ! command -v docker >/dev/null 2>&1; then
  echo "Installing Docker..."
  apt-get update
  apt-get install -y ca-certificates curl
  curl -fsSL https://get.docker.com | sh
fi

if [[ "${USE_EXISTING_TRAEFIK:-false}" != "true" ]]; then
  if [[ -z "${ACME_EMAIL:-}" || "${ACME_EMAIL}" == "you@example.com" ]]; then
    echo "Set ACME_EMAIL in ${ENV_FILE} for Let's Encrypt certificates."
    exit 1
  fi

  echo "Starting Traefik..."
  docker compose -f "${APP_DIR}/deploy/traefik/docker-compose.yml" --env-file "${ENV_FILE}" up -d
else
  echo "Using existing Traefik on network ${TRAEFIK_NETWORK:-coolify}..."
fi

echo "Building and starting app stack..."
docker compose -f "${APP_DIR}/deploy/docker-compose.yml" --env-file "${ENV_FILE}" up -d --build

echo ""
echo "Deployment started."
echo "  App:  https://${APP_SUBDOMAIN}.${DOMAIN_NAME}"
echo "  API:  https://${API_SUBDOMAIN}.${DOMAIN_NAME}"
echo "  WAHA: https://${WAHA_SUBDOMAIN}.${DOMAIN_NAME}"
echo ""
echo "Check status:"
echo "  docker compose -f ${APP_DIR}/deploy/docker-compose.yml --env-file ${ENV_FILE} ps"
