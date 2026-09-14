#!/bin/sh
set -e

DOMAIN="${DOMAIN:-localhost}"
CERT_PATH="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
KEY_PATH="/etc/letsencrypt/live/${DOMAIN}/privkey.pem"

mkdir -p /etc/nginx/conf.d

if [ -f "$CERT_PATH" ] && [ -f "$KEY_PATH" ]; then
    echo "==> [Nginx Entrypoint] SSL certificates found for ${DOMAIN}. Applying HTTPS configuration..."
    envsubst '${DOMAIN}' < /etc/nginx/custom-templates/ssl.conf.tmpl > /etc/nginx/conf.d/default.conf
else
    echo "==> [Nginx Entrypoint] SSL certificates not found for ${DOMAIN}. Applying HTTP ACME configuration..."
    envsubst '${DOMAIN}' < /etc/nginx/custom-templates/http.conf.tmpl > /etc/nginx/conf.d/default.conf
fi

# Run background loop to reload Nginx once a day to pick up renewed certificates
(
    while true; do
        sleep 24h
        if [ -f "$CERT_PATH" ] && [ -f "$KEY_PATH" ]; then
            echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] Gracefully reloading Nginx to apply any certificate renewals..."
            nginx -s reload 2>/dev/null || true
        fi
    done
) &
