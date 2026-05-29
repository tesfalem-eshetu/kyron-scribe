#!/usr/bin/env bash
set -euo pipefail

# Reads all SSM parameters under /<project> and writes them to the app .env file.
# The instance's IAM role grants read + KMS decrypt; no secrets live on disk in git.

PROJECT_NAME="${PROJECT_NAME:-kyron-scribe}"
AWS_REGION="${AWS_REGION:-us-east-1}"
APP_DIR="${APP_DIR:-/opt/kyron-scribe}"
ENV_FILE="${APP_DIR}/.env"
PREFIX="/${PROJECT_NAME}"

echo "Fetching parameters from SSM path ${PREFIX} in ${AWS_REGION}..."

tmp_file="$(mktemp)"

# Page through every parameter under the prefix and emit KEY=VALUE lines.
next_token=""
while true; do
  if [ -z "${next_token}" ]; then
    page="$(aws ssm get-parameters-by-path \
      --region "${AWS_REGION}" \
      --path "${PREFIX}" \
      --with-decryption \
      --recursive \
      --output json)"
  else
    page="$(aws ssm get-parameters-by-path \
      --region "${AWS_REGION}" \
      --path "${PREFIX}" \
      --with-decryption \
      --recursive \
      --starting-token "${next_token}" \
      --output json)"
  fi

  echo "${page}" | python3 -c '
import json, sys
data = json.load(sys.stdin)
for p in data.get("Parameters", []):
    key = p["Name"].rsplit("/", 1)[-1]
    val = p["Value"].replace("\n", "\\n")
    print(f"{key}={val}")
' >>"${tmp_file}"

  next_token="$(echo "${page}" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("NextToken",""))')"
  [ -z "${next_token}" ] && break
done

install -m 600 -o kyron -g kyron "${tmp_file}" "${ENV_FILE}"
rm -f "${tmp_file}"

echo "Wrote ${ENV_FILE} ($(wc -l <"${ENV_FILE}") entries)."
