#!/bin/sh
set -e

# Strip any Windows \r and leading/trailing whitespace
DOMAIN="$(echo "${DOMAIN:-localhost}" | tr -d '\r' | tr -d ' ')"
CERT_PATH="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
KEY_PATH="/etc/letsencrypt/live/${DOMAIN}/privkey.pem"

mkdir -p /etc/nginx/conf.d

# If not found directly under $DOMAIN, check if any certificate exists in /etc/letsencrypt/live/
if [ ! -f "$CERT_PATH" ] && [ -d "/etc/letsencrypt/live" ]; then
    for dir in /etc/letsencrypt/live/*; do
        if [ -d "$dir" ] && [ -f "$dir/fullchain.pem" ] && [ -f "$dir/privkey.pem" ]; then
            CERT_PATH="$dir/fullchain.pem"
            KEY_PATH="$dir/privkey.pem"
            detected_domain="$(basename "$dir")"
            echo "==> [Nginx Entrypoint] Found SSL certificate in $dir (domain: $detected_domain)"
            DOMAIN="$detected_domain"
            break
        fi
    done
fi

export DOMAIN

if [ -f "$CERT_PATH" ] && [ -f "$KEY_PATH" ]; then
    echo "==> [Nginx Entrypoint] SSL certificates found for ${DOMAIN}. Applying HTTPS configuration with HTTP->HTTPS redirect..."
    envsubst '${DOMAIN}' < /etc/nginx/custom-templates/ssl.conf.tmpl > /etc/nginx/conf.d/default.conf
else
    echo "==> [Nginx Entrypoint] SSL certificates not found for ${DOMAIN}. Applying HTTP ACME configuration..."
    envsubst '${DOMAIN}' < /etc/nginx/custom-templates/http.conf.tmpl > /etc/nginx/conf.d/default.conf
fi

# Background watcher:
# 1) Auto-upgrades to HTTPS as soon as certificates appear (e.g. after running init-letsencrypt.sh)
# 2) Reloads Nginx periodically to apply renewed certificates
(
    while true; do
        sleep 10
        # If currently running without SSL, check if certs have now appeared
        if [ -f "$CERT_PATH" ] && [ -f "$KEY_PATH" ]; then
            if ! grep -q "ssl_certificate" /etc/nginx/conf.d/default.conf 2>/dev/null; then
                echo "==> [Nginx Watcher] SSL certificates detected for ${DOMAIN}! Upgrading to HTTPS configuration..."
                envsubst '${DOMAIN}' < /etc/nginx/custom-templates/ssl.conf.tmpl > /etc/nginx/conf.d/default.conf
                nginx -s reload 2>/dev/null || true
            fi
        else
            # Re-check in case a certificate folder was created
            if [ -d "/etc/letsencrypt/live" ]; then
                for dir in /etc/letsencrypt/live/*; do
                    if [ -d "$dir" ] && [ -f "$dir/fullchain.pem" ] && [ -f "$dir/privkey.pem" ]; then
                        CERT_PATH="$dir/fullchain.pem"
                        KEY_PATH="$dir/privkey.pem"
                        DOMAIN="$(basename "$dir")"
                        export DOMAIN
                        echo "==> [Nginx Watcher] SSL certificates detected in $dir! Upgrading to HTTPS..."
                        envsubst '${DOMAIN}' < /etc/nginx/custom-templates/ssl.conf.tmpl > /etc/nginx/conf.d/default.conf
                        nginx -s reload 2>/dev/null || true
                        break
                    fi
                done
            fi
        fi

        # Daily reload check for renewals
        sleep 43200
        if [ -f "$CERT_PATH" ] && [ -f "$KEY_PATH" ]; then
            echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] [Nginx Watcher] Reloading Nginx for renewed certificates..."
            nginx -s reload 2>/dev/null || true
        fi
    done
) &
