#!/usr/bin/env bash
set -euo pipefail

# Run ON the EC2 host after code is present at $APP_DIR.
# Idempotent: safe to re-run for redeploys.

# Pull config written by Terraform's user_data bootstrap.
if [ -f /etc/kyron-scribe.env ]; then
  # shellcheck disable=SC1091
  source /etc/kyron-scribe.env
fi

PROJECT_NAME="${PROJECT_NAME:-kyron-scribe}"
AWS_REGION="${AWS_REGION:-us-east-1}"
APP_DIR="${APP_DIR:-/opt/kyron-scribe}"
APP_USER="${APP_USER:-kyron}"
DOMAIN_NAME="${DOMAIN_NAME:?DOMAIN_NAME must be set}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "==> 1/8 Writing .env from SSM"
PROJECT_NAME="${PROJECT_NAME}" AWS_REGION="${AWS_REGION}" APP_DIR="${APP_DIR}" \
  bash "${SCRIPT_DIR}/fetch-env.sh"

echo "==> 2/8 Installing dependencies"
cd "${APP_DIR}"
sudo -u "${APP_USER}" pnpm install --frozen-lockfile

echo "==> 3/8 Generating Prisma client + applying migrations"
sudo -u "${APP_USER}" --preserve-env=DATABASE_URL pnpm exec prisma generate
set -a; # shellcheck disable=SC1091
source "${APP_DIR}/.env"; set +a
sudo -u "${APP_USER}" DATABASE_URL="${DATABASE_URL}" pnpm exec prisma migrate deploy

echo "==> 4/8 Seeding base data (idempotent)"
sudo -u "${APP_USER}" DATABASE_URL="${DATABASE_URL}" pnpm exec prisma db seed || true

echo "==> 5/8 Seeding ICD-10 embeddings (idempotent; skips already-embedded rows)"
sudo -u "${APP_USER}" --preserve-env pnpm run embed:icd10 || true

echo "==> 6/8 Building Next.js"
sudo -u "${APP_USER}" --preserve-env pnpm run build

echo "==> 7/8 Installing systemd unit"
install -m 644 "${REPO_ROOT}/deploy/systemd/${PROJECT_NAME}.service" \
  "/etc/systemd/system/${PROJECT_NAME}.service"
systemctl daemon-reload
systemctl enable "${PROJECT_NAME}"
systemctl restart "${PROJECT_NAME}"

echo "==> 8/8 Configuring nginx + TLS"
sed "s/__DOMAIN__/${DOMAIN_NAME}/g" \
  "${REPO_ROOT}/deploy/nginx/${PROJECT_NAME}.conf" \
  >"/etc/nginx/sites-available/${PROJECT_NAME}.conf"
ln -sf "/etc/nginx/sites-available/${PROJECT_NAME}.conf" \
  "/etc/nginx/sites-enabled/${PROJECT_NAME}.conf"
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# Obtain/renew the certificate and let certbot rewrite the server block for 443.
certbot --nginx -d "${DOMAIN_NAME}" --non-interactive --agree-tos \
  --register-unsafely-without-email --redirect || \
  echo "certbot failed (check DNS A record points at this host), continuing."

systemctl reload nginx
echo "Deploy complete. App should be live at https://${DOMAIN_NAME}"
