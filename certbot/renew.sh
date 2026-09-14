#!/bin/sh
# Automated certificate renewal daemon for Certbot
set -eu

echo "==> Certbot renewal daemon started."

# Initial sleep on startup to prevent hammering Let's Encrypt API on immediate reboots
sleep 30

while true; do
    echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] Checking certificates for renewal..."
    certbot renew --no-random-sleep-on-renew
    echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] Renewal check complete. Sleeping for 12 hours..."
    sleep 12h
done
