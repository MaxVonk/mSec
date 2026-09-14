#!/bin/bash
# Bootstrap Let's Encrypt certificates before the first deployment.
# Run this ONCE, then use `docker compose up -d` for all subsequent starts.
#
# Prerequisites:
#   - Docker running
#   - .env file filled in (copy .env.example -> .env)
#   - For HTTP challenge: port 80 reachable from the internet on DOMAIN
#   - For DNS challenge: DNS provider plugin image + credentials file configured
set -euo pipefail

if [ ! -f .env ]; then
    echo "Error: .env not found. Run: cp .env.example .env and fill in the values."
    exit 1
fi

# Parse only the required variables so shell-special characters in other .env
# values do not affect this script.
env_get() {
    awk -F= -v key="${1}" '$1 == key { sub(/\r$/, ""); sub(/^[^=]+=/, ""); gsub(/^['"'"'"]|['"'"'"]$/, ""); print; exit }' .env
}

resolve_path() {
    local target="${1}"
    local target_dir target_base
    target_dir="$(dirname -- "${target}")"
    target_base="$(basename -- "${target}")"
    (
        cd "${target_dir}" >/dev/null 2>&1 || exit 1
        printf '%s/%s\n' "$(pwd -P)" "${target_base}"
    )
}

DOMAIN="$(env_get DOMAIN | tr -d '\r' | xargs)"
EMAIL="$(env_get CERTBOT_EMAIL | tr -d '\r' | xargs)"
STAGING="$(env_get CERTBOT_STAGING)"
CHALLENGE_METHOD="$(env_get CERTBOT_CHALLENGE_METHOD)"
DNS_PROVIDER="$(env_get CERTBOT_DNS_PROVIDER)"
DNS_CREDENTIALS_FILE="$(env_get CERTBOT_DNS_CREDENTIALS_FILE)"
DNS_PROPAGATION_SECONDS="$(env_get CERTBOT_DNS_PROPAGATION_SECONDS)"
CERTBOT_IMAGE="$(env_get CERTBOT_IMAGE)"

DOMAIN="${DOMAIN:?DOMAIN must be set in .env}"
EMAIL="${EMAIL:?CERTBOT_EMAIL must be set in .env}"
STAGING="${STAGING:-true}"
CHALLENGE_METHOD="${CHALLENGE_METHOD:-http}"
DNS_PROPAGATION_SECONDS="${DNS_PROPAGATION_SECONDS:-60}"
CERTBOT_IMAGE="${CERTBOT_IMAGE:-}"
HEALTHCHECK_DIR="./certbot/www/.well-known/acme-challenge"
HEALTHCHECK_FILE="${HEALTHCHECK_DIR}/healthcheck"

trap 'rm -f "${HEALTHCHECK_FILE}"' EXIT

echo "==> Bootstrapping Let's Encrypt for ${DOMAIN}"
echo "    Staging: ${STAGING}"
echo "    Challenge: ${CHALLENGE_METHOD}"

mkdir -p ./certbot/conf ./certbot/creds "${HEALTHCHECK_DIR}"
printf '%s\n' ready > "${HEALTHCHECK_FILE}"

STAGING_FLAG=""
[ "${STAGING}" != "false" ] && STAGING_FLAG="--staging"

COMMON_ARGS=(
    certonly
    --non-interactive --agree-tos
    --email "${EMAIL}"
    -d "${DOMAIN}"
    --force-renewal
    --rsa-key-size 2048
    --no-eff-email
)

if [ -n "${STAGING_FLAG}" ]; then
    COMMON_ARGS+=("${STAGING_FLAG}")
fi

if [ "${CHALLENGE_METHOD}" = "dns" ]; then
    DNS_PROVIDER="${DNS_PROVIDER:?CERTBOT_DNS_PROVIDER must be set in .env when CERTBOT_CHALLENGE_METHOD=dns}"

    if [ -z "${CERTBOT_IMAGE}" ]; then
        CERTBOT_IMAGE="certbot/dns-${DNS_PROVIDER}:latest"
    fi

    DNS_CREDENTIALS_FILE="${DNS_CREDENTIALS_FILE:-./certbot/creds/${DNS_PROVIDER}.ini}"

    if [ ! -f "${DNS_CREDENTIALS_FILE}" ]; then
        echo "DNS credentials file not found: ${DNS_CREDENTIALS_FILE}" >&2
        exit 1
    fi

    if [ ! -r "${DNS_CREDENTIALS_FILE}" ]; then
        echo "DNS credentials file is not readable: ${DNS_CREDENTIALS_FILE}" >&2
        exit 1
    fi

    if ! creds_dir_real="$(resolve_path ./certbot/creds)"; then
        echo "Unable to resolve ./certbot/creds directory path." >&2
        exit 1
    fi

    if ! creds_file_real="$(resolve_path "${DNS_CREDENTIALS_FILE}")"; then
        echo "Unable to resolve DNS credentials file path: ${DNS_CREDENTIALS_FILE}" >&2
        exit 1
    fi
    case "${creds_file_real}" in
        "${creds_dir_real}/"*) ;;
        *)
            echo "DNS credentials file must be stored under ./certbot/creds for automated renewal." >&2
            exit 1
            ;;
    esac

    if ! [[ "${DNS_PROPAGATION_SECONDS}" =~ ^[0-9]+$ ]]; then
        echo "CERTBOT_DNS_PROPAGATION_SECONDS must be a non-negative integer." >&2
        exit 1
    fi

    if ! chmod 600 "${DNS_CREDENTIALS_FILE}"; then
        echo "Warning: unable to set permissions to 600 on ${DNS_CREDENTIALS_FILE}" >&2
    fi

    credentials_basename="$(basename "${DNS_CREDENTIALS_FILE}")"
    container_credentials_file="/certbot-creds/${credentials_basename}"
    dns_authenticator="--dns-${DNS_PROVIDER}"
    dns_credentials_flag="--dns-${DNS_PROVIDER}-credentials"
    dns_propagation_flag="--dns-${DNS_PROVIDER}-propagation-seconds"

    echo "==> Requesting certificate from Let's Encrypt with DNS challenge (${DNS_PROVIDER})..."
    docker run --rm \
        -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
        -v "$(pwd)/certbot/www:/var/www/certbot" \
        -v "$(pwd)/certbot/creds:/certbot-creds:ro" \
        "${CERTBOT_IMAGE}" \
        "${COMMON_ARGS[@]}" \
        "${dns_authenticator}" \
        "${dns_credentials_flag}" "${container_credentials_file}" \
        "${dns_propagation_flag}" "${DNS_PROPAGATION_SECONDS}"
else
    if [ "${CHALLENGE_METHOD}" != "http" ]; then
        echo "Unsupported CERTBOT_CHALLENGE_METHOD: ${CHALLENGE_METHOD} (expected: http or dns)" >&2
        exit 1
    fi

    if [ -z "${CERTBOT_IMAGE}" ]; then
        CERTBOT_IMAGE="certbot/certbot:latest"
    fi

    echo "==> Starting nginx for ACME HTTP challenge..."
    DOMAIN="${DOMAIN}" docker compose up -d nginx

    echo "==> Waiting for nginx to be ready..."
    attempts=0
    until docker compose exec -T nginx sh -c "wget -q -O - http://127.0.0.1/.well-known/acme-challenge/healthcheck" 2>/dev/null | grep -qx "ready"; do
        attempts=$((attempts + 1))
        if [ "${attempts}" -ge 30 ]; then
            echo "nginx did not become ready in time." >&2
            exit 1
        fi
        sleep 1
    done

    echo "==> Requesting certificate from Let's Encrypt with HTTP challenge..."
    docker run --rm \
        -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
        -v "$(pwd)/certbot/www:/var/www/certbot" \
        "${CERTBOT_IMAGE}" \
        "${COMMON_ARGS[@]}" \
        --webroot -w /var/www/certbot
fi

echo "==> Certificate obtained! Applying HTTPS configuration in nginx..."
if [ -n "$(docker compose ps -q nginx 2>/dev/null)" ]; then
    docker compose restart nginx
else
    DOMAIN="${DOMAIN}" docker compose up -d nginx
fi

echo ""
echo "==> Done. Start the full stack with:"
echo "    docker compose up -d --build"

