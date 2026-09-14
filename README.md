# mSec — Microsoft 365 & Sentinel Tier-3 SOC Command Hub

<p align="center">
  <strong>A unified, enterprise-grade Security Operations Platform for Microsoft 365 Defender (XDR), Microsoft Sentinel (SIEM), and Microsoft Entra ID.</strong><br>
  Featuring automated normalization, cross-incident entity correlation, SOAR containment playbooks, PhishPilot email threat forensics, MITRE ATT&CK mapping, and tactical War Room HUD.
</p>

---

## 📑 Table of Contents

- [Overview](#overview)
- [Key Architectural Features](#key-architectural-features)
  - [1. Multi-Source Ingestion & Automated Normalization](#1-multi-source-ingestion--automated-normalization)
  - [2. PhishPilot: Email Threat Analysis & Coaching](#2-phishpilot-email-threat-analysis--coaching)
  - [3. SOAR Automated Playbook Runner](#3-soar-automated-playbook-runner)
  - [4. Tactical SOC War Room HUD](#4-tactical-soc-war-room-hud)
  - [5. MITRE ATT&CK Enterprise Matrix](#5-mitre-attck-enterprise-matrix)
  - [6. Shift Handover Reports & Incident Forensics](#6-shift-handover-reports--incident-forensics)
  - [7. Threat Intelligence & Reputation Engine](#7-threat-intelligence--reputation-engine)
  - [8. Enterprise RBAC & Authentication](#8-enterprise-rbac--authentication)
  - [9. Production Demo Mode Safeguard](#9-production-demo-mode-safeguard)
- [Quick Start with Docker Compose](#quick-start-with-docker-compose)
- [HTTPS & Automated Let's Encrypt Setup (Certbot)](#https--automated-lets-encrypt-setup-certbot)
- [Local Development](#local-development)
- [Automated Microsoft Entra ID Setup](#automated-microsoft-entra-id-setup)
- [Configuration Reference](#configuration-reference)
- [Testing & Quality Assurance](#testing--quality-assurance)

---

## Overview

**mSec** consolidates fragmented telemetry from Microsoft's security ecosystem into a single, high-velocity operational workspace. Built for Tier-1 to Tier-3 SOC analysts, incident responders, and security leads, mSec correlates disparate alerts, visualizes blast radiuses across hybrid identities, hosts, and networks, and executes rapid containment workflows with auditable logging.

---

## Key Architectural Features

### 1. Multi-Source Ingestion & Automated Normalization
- **Microsoft 365 Defender XDR**: Direct ingestion via Microsoft Graph Security API (`/v1.0/security/incidents` and `/alerts_v2`), extracting deep alert evidence, process trees, and device states.
- **Microsoft Sentinel SIEM**: Live polling and sync against Azure Resource Manager (ARM) REST APIs for Sentinel workspaces.
- **Microsoft Entra ID**: Automated correlation of risky sign-ins, anomalous authentications, and compromised identities.
- **Scheduled Ingestion Poller**: Configurable background polling intervals with status tracking and error management.
- **Offline / Forensic Upload**: Drag-and-drop ingestion of `.json` and `.csv` alert dumps for offline forensic analysis.

### 2. PhishPilot: Email Threat Analysis & Coaching
- **Comprehensive Forensics**: Automated parsing of `.eml` files, RFC 822 headers, authentication passes (`SPF`, `DKIM`, `DMARC`), and hop latency tracking.
- **Homoglyph & Brand Spoofing Engine**: Detects Cyrillic/Greek Unicode confusables, typosquatting, and leetspeak brand impersonations.
- **Automated Remediation**: One-click tenant-wide mailbox purge, Tenant Allow/Block List (TABL) domain entry, and recipient session revocation.
- **Automated Coaching Loop**: Instant generation of educational HTML feedback for reported phishing attacks and positive reinforcement for legitimate emails.
- **STIX 2.1 & JSON Export**: Export standardized threat bundles compliant with OASIS STIX 2.1.
- **Microsoft Outlook 365 Add-in**: Included native Office.js manifest (`manifest.xml`) and taskpane for 1-click user reporting directly within Outlook Web and Desktop.

### 3. SOAR Automated Playbook Runner
- **Rapid-Containment Runbooks**: Prebuilt, sequential playbooks with step-by-step API dispatch:
  - *Compromised Identity Rapid Containment* (Revoke sessions, enforce password reset, elevate MFA)
  - *Ransomware Host & Process Isolation* (Isolate Defender endpoint, terminate malicious PIDs)
  - *Phishing Campaign Tenant Purge* (Purge mailboxes, add TABL drop rules, notify recipients)
  - *Data Exfiltration Perimeter Blockade* (Block C2 egress, quarantine delegated OAuth apps)
- **Interactive Remediation Target Scope**: Explicitly choose any active incident or specify ad-hoc target user UPNs, hostnames, and IP indicators.
- **Simulation Mode**: Built-in dry-run execution toggle with live terminal audit logs.

### 4. Tactical SOC War Room HUD
- **Fullscreen Command Center**: High-contrast, tactical dark HUD engineered for wall monitors and high-stress operational briefings.
- **Synthesized Web Audio API**: Crisp, futuristic audio cues for high-severity alerts and playbook execution completion—requiring zero external MP3 assets, with persistent mute control.
- **Live Threat Stream & Visual Timeline**: Real-time incident tracking categorized by severity, provider, and tactical urgency.

### 5. MITRE ATT&CK Enterprise Matrix
- **12-Tactic Visual Matrix**: Full enterprise attack lifecycle heatmap from *Initial Access* to *Impact*.
- **Incident Technique Mapping**: Visual badges linking live active incidents to specific techniques with 1-click playbook invocation.

### 6. Shift Handover Reports & Incident Forensics
- **SOC Shift Handover Generator**: Aggregates operational telemetry metrics, open critical incidents, top targeted users, and pending actions across configurable timeframes (8h, 12h, 24h, 48h).
- **Incident Markdown Dossiers**: 1-click generation of comprehensive, audit-ready incident post-mortem reports.

### 7. Threat Intelligence & Reputation Engine
- **Reputation Providers**: Integrated live lookups via VirusTotal, AbuseIPDB, and Google Safe Browsing API.
- **Heuristic Fallback Engine**: RFC 1918 private IP filtering, known C2 heuristic indicators, and local memory caching with TTL.
- **Outbound Webhooks**: Instant notification dispatch to Microsoft Teams and Slack for High and Critical severity incidents.

### 8. Enterprise RBAC & Authentication
- **Dual Authentication Modes**: Seamless Microsoft Entra ID SSO (OAuth2 PKCE) alongside secure local administrative authentication.
- **Role-Based Access Control (RBAC)**: `ADMIN`, `ANALYST`, and `READONLY` access levels.
- **Password Security**: Unique per-user random cryptographic salt with PBKDF2 HMAC-SHA512 hashing, brute-force protection, and self-service password reset.

### 9. Production Demo Mode Safeguard
- **Environment Protection**: Easily toggle between demonstration/staging datasets and live production data.
- **Safe by Default**: When configured with `DEMO_MODE=false`, demo reset endpoints (`/api/demo/reset`) return `HTTP 403 Forbidden`, and UI reset buttons are automatically hidden.

---

## Quick Start with Docker Compose

Deploy the complete platform (frontend + backend + persistent volume) with a single command:

```bash
# Clone the repository
git clone http://192.168.0.233:1619/max/mSec.git
cd mSec

# Launch container
docker compose up -d
```

Access the application in your browser:
**[http://localhost:3310](http://localhost:3310)**

Default local administrator credentials (initialized on first boot):
* **Username:** `admin`
* **Password:** `AdminSecure2026!`

To monitor logs or stop the container:
```bash
docker compose logs -f
docker compose down
```

---

## HTTPS & Automated Let's Encrypt Setup (Certbot)

mSec includes automated SSL/TLS certificate management using **Let's Encrypt (Certbot)** and an **Nginx reverse proxy**. It supports both internet-facing servers (HTTP challenge) and internal/private office networks (DNS challenge).

### 1. Configure Environment Variables in `.env`

Copy `.env.example` to `.env` and configure your domain settings:

```env
# Public base URL
APP_URL=https://vpass.vermiculus.work

# Domain name for SSL certificate
DOMAIN=vpass.vermiculus.work

# Let's Encrypt registration email
CERTBOT_EMAIL=internal_it@vermiculus.se

# Set to 'false' for production certificates; use 'true' to avoid rate limits while testing
CERTBOT_STAGING=false
```

### 2. Choose Your Challenge Method

#### Method A: DNS-01 Challenge (Recommended for Internal / Office Deployments)
Works behind private networks without exposing port 80 to the internet.

1. Set the following in `.env`:
   ```env
   CERTBOT_CHALLENGE_METHOD=dns
   CERTBOT_DNS_PROVIDER=cloudflare
   CERTBOT_IMAGE=certbot/dns-cloudflare:latest
   CERTBOT_DNS_CREDENTIALS_FILE=./certbot/creds/cloudflare.ini
   CERTBOT_DNS_PROPAGATION_SECONDS=60
   ```
2. Create `./certbot/creds/cloudflare.ini` (see `certbot/creds/cloudflare.ini.example`):
   ```ini
   dns_cloudflare_api_token = YOUR_CLOUDFLARE_API_TOKEN
   ```
3. Secure the credentials file:
   ```bash
   chmod 600 ./certbot/creds/cloudflare.ini
   ```

#### Method B: HTTP-01 Challenge (For Internet-Reachable Servers)
Requires inbound port 80 open from the internet to your server.

```env
CERTBOT_CHALLENGE_METHOD=http
```

### 3. Bootstrap the Certificates (Run Once)

Execute the initialization script:

```bash
chmod +x init-letsencrypt.sh
./init-letsencrypt.sh
# or: npm run setup:ssl
```

This script:
1. Validates `.env` and challenge requirements.
2. Boots up the Nginx reverse proxy with ACME challenge routing.
3. Requests and installs the official Let's Encrypt certificates into `./certbot/conf`.
4. Gracefully reloads Nginx with full TLS (HTTP/2, modern ciphers, and automatic HTTP-to-HTTPS redirect).

### 4. Automated Certificate Renewals

Once bootstrapped, run the full stack:

```bash
docker compose up -d
```

The background `certbot` container checks for renewal every 12 hours. Nginx periodically reloads to seamlessly pick up renewed certificates without downtime.

---

## Local Development

Prerequisites: Node.js 20+ and npm.

```bash
# Install dependencies
npm install

# Run backend API (port 3310) and Vite frontend (port 5173) concurrently
npm run dev

# Run automated unit test suite
npm test

# Build production bundle
npm run build
```

---

## Automated Microsoft Entra ID Setup

For Linux / macOS / WSL environments, an automated onboarding script is provided to register your Microsoft Entra application and grant Graph API permissions:

```bash
chmod +x scripts/setup-entra.sh
./scripts/setup-entra.sh
# or: npm run setup:entra
```

---

## Configuration Reference

Configure settings in `docker-compose.yml` or via a root `.env` file:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3310` | HTTP listening port |
| `NODE_ENV` | `production` | Node environment (`production` / `development`) |
| `DEMO_MODE` | `false` | Set to `true` to enable demo dataset resets in staging |
| `VIRUSTOTAL_API_KEY` | *(optional)* | API key for VirusTotal IP/Domain/File reputation |
| `ABUSEIPDB_KEY` | *(optional)* | API key for AbuseIPDB IP reputation lookup |
| `GOOGLE_SAFEBROWSING_KEY` | *(optional)* | API key for Google Safe Browsing URL threat detection |
| `AZURE_OPENAI_ENDPOINT` | *(optional)* | Azure OpenAI endpoint URL |
| `AZURE_OPENAI_API_KEY` | *(optional)* | Azure OpenAI service key |

---

## Testing & Quality Assurance

mSec features a test suite utilizing Node.js's native test runner (`node:test`) and strict assertion library:

```bash
npm test
```

### Verified Test Suites (66 passing tests):
- ✅ **Normalization**: M365 Defender XDR, Sentinel SIEM, Entra ID risky sign-ins.
- ✅ **PhishPilot Forensics**: RFC 822 parser, SPF/DKIM/DMARC analysis, Homoglyph detector, STIX 2.1 generator.
- ✅ **SOAR Playbooks**: Rapid-containment runbook definitions and sequential execution.
- ✅ **Authentication & UserStore**: Salt/hash security, RBAC enforcement, session management.
- ✅ **Operations & Services**: Ingestion scheduler, webhook notifier, threat intelligence engine, shift handover reports, and production demo mode switch.
