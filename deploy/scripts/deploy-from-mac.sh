#!/usr/bin/env bash
# Sync local repo to Hostinger VPS and rebuild containers.
set -euo pipefail

VPS_HOST="${VPS_HOST:-root@69.62.124.22}"
APP_DIR="${APP_DIR:-/opt/lead-outreach-platform}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

SSH_OPTS=(-o BatchMode=yes)
if [[ -f "${SSH_KEY}" ]]; then
  SSH_OPTS+=(-i "${SSH_KEY}")
fi

RSYNC_SSH="ssh ${SSH_OPTS[*]}"

echo "Testing SSH to ${VPS_HOST}..."
if ! ssh "${SSH_OPTS[@]}" "${VPS_HOST}" "echo ok" >/dev/null; then
  echo "SSH failed. Add your Mac public key to the VPS first:"
  echo "  ssh-copy-id -i ${SSH_KEY}.pub ${VPS_HOST}"
  echo "Or paste this key in Hostinger hPanel → VPS → SSH Keys:"
  cat "${SSH_KEY}.pub" 2>/dev/null || cat "$HOME/.ssh/id_ed25519.pub"
  exit 1
fi

echo "Syncing code to ${VPS_HOST}:${APP_DIR} ..."
ssh "${SSH_OPTS[@]}" "${VPS_HOST}" "mkdir -p ${APP_DIR}"
rsync -avz --delete \
  --exclude node_modules \
  --exclude .next \
  --exclude dist \
  --exclude .git \
  --exclude deploy/.env \
  -e "${RSYNC_SSH}" \
  "${REPO_ROOT}/" "${VPS_HOST}:${APP_DIR}/"

if ! ssh "${SSH_OPTS[@]}" "${VPS_HOST}" "test -f ${APP_DIR}/deploy/.env"; then
  echo "Creating deploy/.env from example on VPS (edit passwords before production use)..."
  ssh "${SSH_OPTS[@]}" "${VPS_HOST}" "cp ${APP_DIR}/deploy/.env.example ${APP_DIR}/deploy/.env"
  echo "Edit secrets on the VPS:"
  echo "  ssh ${SSH_OPTS[*]} ${VPS_HOST}"
  echo "  nano ${APP_DIR}/deploy/.env"
  exit 1
fi

echo "Deploying containers..."
ssh "${SSH_OPTS[@]}" "${VPS_HOST}" "bash ${APP_DIR}/deploy/scripts/bootstrap-vps.sh"

echo "Done."
