#!/usr/bin/env bash
set -euo pipefail

# Run ON the EC2 host as root (sudo) after code is present at $APP_DIR.
# Idempotent: safe to re-run for redeploys.

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

# Stop corepack from prompting before it downloads pnpm.
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

echo "==> 1/8 Writing .env from SSM"
PROJECT_NAME="${PROJECT_NAME}" AWS_REGION="${AWS_REGION}" APP_DIR="${APP_DIR}" \
  bash "${SCRIPT_DIR}/fetch-env.sh"

# Load app config so DATABASE_URL etc. are available to build/migrate/seed.
set -a
# shellcheck disable=SC1091
source "${APP_DIR}/.env"
set +a

# Run a command as the app user with the env it needs.
# NODE_ENV is intentionally NOT forced to production here, or pnpm would skip
# devDependencies (prisma, tsx, typescript, tailwind) that the build requires.
run_as_app() {
  sudo -u "${APP_USER}" env \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    PATH="${PATH}" \
    DATABASE_URL="${DATABASE_URL:-}" \
    OPENAI_API_KEY="${OPENAI_API_KEY:-}" \
    OPENAI_EMBEDDING_MODEL="${OPENAI_EMBEDDING_MODEL:-}" \
    OPENAI_SOAP_GENERATION_MODEL="${OPENAI_SOAP_GENERATION_MODEL:-}" \
    OPENAI_PROBLEM_EXTRACT_MODEL="${OPENAI_PROBLEM_EXTRACT_MODEL:-}" \
    SESSION_COOKIE_NAME="${SESSION_COOKIE_NAME:-session_token}" \
    SESSION_TTL_HOURS="${SESSION_TTL_HOURS:-24}" \
    "$@"
}

cd "${APP_DIR}"

echo "==> 2/8 Installing dependencies"
run_as_app pnpm install --frozen-lockfile

echo "==> 3/8 Generating Prisma client + applying migrations"
# Client only — skip ERD generator (puppeteer) on the server.
run_as_app pnpm exec prisma generate --generator client
run_as_app pnpm exec prisma migrate deploy

echo "==> 4/8 Seeding base data (idempotent)"
run_as_app pnpm exec prisma db seed || true

echo "==> 5/8 Seeding ICD-10 embeddings (idempotent; skips already-embedded rows)"
run_as_app pnpm run embed:icd10 || true

echo "==> 6/8 Building Next.js"
run_as_app pnpm run build

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

# Obtain/renew the cert for both root and www, then let certbot rewrite for 443.
certbot --nginx -d "${DOMAIN_NAME}" -d "www.${DOMAIN_NAME}" --non-interactive \
  --agree-tos --register-unsafely-without-email --redirect || \
  echo "certbot failed (check DNS A records point at this host), continuing."

systemctl reload nginx
echo "Deploy complete. App should be live at https://${DOMAIN_NAME}"
