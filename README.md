# mSec — Microsoft 365 & Sentinel Tier-3 SOC Command Hub

<p align="center">
  <strong>A unified, enterprise-grade Security Operations Platform for Microsoft 365 Defender (XDR), Microsoft Sentinel (SIEM), and Microsoft Entra ID.</strong><br>
  Featuring automated normalization, cross-incident entity correlation, SOAR containment playbooks, PhishPilot email & Quishing threat forensics, MITRE ATT&CK mapping, native SQLite persistence, bidirectional cloud sync, and tactical War Room HUD.
</p>

---

## 📑 Table of Contents

- [Overview](#overview)
- [🎮 Running in Sandboxed Demo Mode (Zero Cloud Config)](#-running-in-sandboxed-demo-mode-zero-cloud-config)
- [Key Architectural Features](#key-architectural-features)
  - [1. Multi-Source Ingestion & Automated Normalization](#1-multi-source-ingestion--automated-normalization)
  - [2. PhishPilot: Email Threat Analysis & Coaching Loop](#2-phishpilot-email-threat-analysis--coaching-loop)
  - [3. PhishPilot Quishing: Embedded Barcode & QR Forensics](#3-phishpilot-quishing-embedded-barcode--qr-forensics)
  - [4. Native SQLite Database Persistence (`node:sqlite`)](#4-native-sqlite-database-persistence-nodesqlite)
  - [5. Bidirectional Microsoft Cloud Sync (Defender & Sentinel)](#5-bidirectional-microsoft-cloud-sync-defender--sentinel)
  - [6. SOAR Automated Playbook Runner](#6-soar-automated-playbook-runner)
  - [7. Tactical SOC War Room HUD](#7-tactical-soc-war-room-hud)
  - [8. MITRE ATT&CK Enterprise Matrix](#8-mitre-attck-enterprise-matrix)
  - [9. Executive Security Briefings & Forensic Dossiers](#9-executive-security-briefings--forensic-dossiers)
  - [10. Threat Intelligence & Reputation Engine](#10-threat-intelligence--reputation-engine)
  - [11. Threat Insight RSS & Cyber Intelligence Feeds](#11-threat-insight-rss--cyber-intelligence-feeds)
  - [12. Enterprise RBAC & Dual Authentication](#12-enterprise-rbac--dual-authentication)
  - [13. Production Demo Mode Safeguard](#13-production-demo-mode-safeguard)
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

## 🎮 Running in Sandboxed Demo Mode (Zero Cloud Config)

mSec is engineered to run **100% self-contained and sandboxed** right out of the box. **No Microsoft Azure, Defender, or Entra tenant credentials are required** to test and demo every feature of the platform.

### 1. Launch the Sandbox
Clone the repository and launch mSec with one command:

```bash
# Clone the repository
git clone https://github.com/MaxVonk/mSec.git
cd mSec

# Install dependencies
npm install

# Start the sandboxed dev environment (frontend + backend concurrently)
npm run demo
# or: npm run dev
```

Alternatively, launch using Docker:
```bash
docker compose up -d
```

### 2. Access the Application
- **Vite Development URL:** [http://localhost:5173](http://localhost:5173) (proxied to API at port 3310)
- **Docker / Production Build URL:** [http://localhost:3310](http://localhost:3310)
- **Default Local Administrator Credentials:**
  - **Username:** `admin`
  - **Password:** `AdminSecure2026!`

---

### 3. Interactive Sandboxed Walkthroughs

Try out all primary features in simulation mode:

#### 🔍 A. PhishPilot Quishing & QR Code Forensics
1. In the top navigation bar, open **PhishPilot**.
2. At the bottom of the submission card, click **"Phishing & Quishing EML"** (or drag & drop `samples/sample_phishing.eml`).
3. View the generated forensic report:
   - **Quishing Analysis Tab:** Inspect the automatically extracted QR code, decoded payload URL (`https://login-microsoft-portal-verify.ru/token-refresh`), and visual indicator tags.
   - **Header & SPF/DKIM Analysis:** View spoofing alerts, SPF/DMARC hard failures, and Reply-To mismatch warnings.
   - **Remediation & Coaching:** Click **"Remediate Email"** to test tenant-wide mailbox purge simulation or generate personalized educational feedback.
4. Try clicking **"Legitimate Clean EML"** (or `samples/sample_legitimate.eml`) to observe how legitimate signatures pass checks and award positive reinforcement badges.

#### ⚡ B. SOAR Automated Playbook Runner
1. Navigate to the **Playbooks** view.
2. Select an active incident or enter target UPNs / IP addresses.
3. Choose a runbook (e.g., *Compromised Identity Rapid Containment* or *Ransomware Host & Process Isolation*).
4. Keep the **Simulation Mode** toggle enabled to safely step through real-time API dispatch, containment status changes, and synthesized terminal logs without touching live production infrastructure.

#### ☁️ C. Bidirectional Microsoft Cloud Sync (Defender & Sentinel)
1. Open any incident in the **Incidents** list to launch the Detail modal.
2. Click the **"Sync to Cloud"** button in the modal header.
3. Update the incident classification (e.g. *True Positive / Malware*), change the operational status, or append an analyst investigation note.
4. When Microsoft credentials are not configured, mSec's connector engine automatically switches to **safe local cloud simulation**, returning formatted provider responses and maintaining full audit trails in the SQLite database.

#### 📂 D. Offline Alert Ingestion & Correlator
1. Open the **Ingestion** tab.
2. Drag and drop either of the pre-packaged forensic sample datasets included in the repository:
   - `m365_defender_incident_export.json`
   - `sentinel_alerts_export.csv`
3. Watch the universal normalizer ingest the alerts, correlate overlapping entities, map tactics to the MITRE ATT&CK matrix, and update incident severity trends.

#### 🎛️ E. Tactical SOC War Room HUD
1. Click the **"War Room"** button in the top navigation.
2. Experience a high-contrast dark cockpit HUD with a live event stream, high-urgency incident ticker, and synthesized Web Audio sound effects for critical incident alerts and playbook completions.

#### 🔄 F. One-Click Demo Reset
- Modify, resolve, or delete incidents as much as you like during a demonstration.
- Click the **"Reset Demo Data"** button in the header bar at any time to instantly restore the SQLite database (`.msec_data/msec.db`) back to its clean initial state.

---

## Key Architectural Features

### 1. Multi-Source Ingestion & Automated Normalization
- **Microsoft 365 Defender XDR**: Ingestion via Microsoft Graph Security API (`/v1.0/security/incidents` and `/alerts_v2`), extracting deep alert evidence, process trees, and device states.
- **Microsoft Sentinel SIEM**: Live polling and sync against Azure Resource Manager (ARM) REST APIs for Sentinel workspaces.
- **Microsoft Entra ID**: Automated correlation of risky sign-ins, anomalous authentications, and compromised identities.
- **Scheduled Ingestion Poller**: Configurable background polling intervals with status tracking and error management.
- **Offline / Forensic Upload**: Drag-and-drop ingestion of `.json` and `.csv` alert dumps for offline forensic analysis.

### 2. PhishPilot: Email Threat Analysis & Coaching Loop
- **Comprehensive Forensics**: Automated parsing of `.eml` files, RFC 822 headers, authentication passes (`SPF`, `DKIM`, `DMARC`), and hop latency tracking.
- **Homoglyph & Brand Spoofing Engine**: Detects Cyrillic/Greek Unicode confusables, typosquatting, and leetspeak brand impersonations.
- **Automated Remediation**: One-click tenant-wide mailbox purge, Tenant Allow/Block List (TABL) domain entry, and recipient session revocation.
- **Automated Coaching Loop**: Instant generation of educational HTML feedback for reported phishing attacks and positive reinforcement for legitimate emails.
- **STIX 2.1 & JSON Export**: Export standardized threat bundles compliant with OASIS STIX 2.1.
- **Microsoft Outlook 365 Add-in**: Included native Office.js manifest (`manifest.xml`) and taskpane for 1-click user reporting directly within Outlook Web and Desktop.

### 3. PhishPilot Quishing: Embedded Barcode & QR Forensics
- **Dual Visual Extraction**: Automatically analyzes both file attachments (`.png`, `.jpg`, `.jpeg`, `.bmp`) and inline `data:image/...;base64` HTML email body tags using `jsqr` and `pngjs`.
- **Target URL Decomposition**: Extracts decoded QR URLs, analyzes them through the homoglyph and reputation scoring engines, and checks against phishing databases.
- **Quishing Risk Escalator**: Elevates overall email risk scores when QR codes redirect to credential harvest or MFA bypass portals.
- **Interactive Quishing Tab**: Analysts can view decoded QR payloads, raw barcodes, extracted URLs, and indicator flags directly in the PhishPilot UI.

### 4. Native SQLite Database Persistence (`node:sqlite`)
- **Zero External Dependencies**: Uses Node.js 22+ / 24+ native SQLite engine (`node:sqlite`) with Write-Ahead Logging (`PRAGMA journal_mode = WAL`) and foreign key integrity.
- **Persistent Storage**: All incidents, PhishPilot reports, and connector settings persist across server restarts in `.msec_data/msec.db`.
- **Automated Migration**: Automatically detects and migrates legacy JSON files to SQLite on startup with full transactional safety.

### 5. Bidirectional Microsoft Cloud Sync (Defender & Sentinel)
- **Two-Way Synchronization**: Allows Tier-3 SOC analysts to triage and update incidents locally in mSec, and sync updates directly back to Microsoft cloud providers.
- **Microsoft Graph Security (XDR)**: Dispatches `PATCH /v1.0/security/incidents/{id}` to update status, classification (*TruePositive*, *FalsePositive*, *BenignPositive*), and append incident comments.
- **Microsoft Sentinel (SIEM)**: Dispatches Azure Resource Manager `PUT` requests to update Sentinel incident classification and status, and `POST` requests to write native Sentinel comments.
- **Simulation Fallback**: If cloud credentials are not supplied, actions automatically execute in simulated mode, allowing full UI testing without external tenant dependencies.

### 6. SOAR Automated Playbook Runner
- **Rapid-Containment Runbooks**: Prebuilt, sequential playbooks with step-by-step API dispatch:
  - *Compromised Identity Rapid Containment* (Revoke sessions, enforce password reset, elevate MFA)
  - *Ransomware Host & Process Isolation* (Isolate Defender endpoint, terminate malicious PIDs)
  - *Phishing Campaign Tenant Purge* (Purge mailboxes, add TABL drop rules, notify recipients)
  - *Data Exfiltration Perimeter Blockade* (Block C2 egress, quarantine delegated OAuth apps)
- **Interactive Remediation Target Scope**: Explicitly choose any active incident or specify ad-hoc target user UPNs, hostnames, and IP indicators.
- **Simulation Mode**: Built-in dry-run execution toggle with live terminal audit logs.

### 7. Tactical SOC War Room HUD
- **Fullscreen Command Center**: High-contrast, tactical dark HUD engineered for wall monitors and high-stress operational briefings.
- **Synthesized Web Audio API**: Crisp, futuristic audio cues for high-severity alerts and playbook execution completion—requiring zero external MP3 assets, with persistent mute control.
- **Live Threat Stream & Visual Timeline**: Real-time incident tracking categorized by severity, provider, and tactical urgency.

### 8. MITRE ATT&CK Enterprise Matrix
- **12-Tactic Visual Matrix**: Full enterprise attack lifecycle heatmap from *Initial Access* to *Impact*.
- **Incident Technique Mapping**: Visual badges linking live active incidents to specific techniques with 1-click playbook invocation.

### 9. Executive Security Briefings & Forensic Dossiers
- **Executive SOC Briefing Generator**: On-demand generation of operational telemetry metrics, open critical incidents, top targeted users, and pending actions across configurable timeframes (8h, 12h, 24h, 72h).
- **Incident Markdown Dossiers**: 1-click generation of comprehensive, audit-ready incident post-mortem reports.

### 10. Threat Intelligence & Reputation Engine
- **Reputation Providers**: Integrated live lookups via VirusTotal, AbuseIPDB, and Google Safe Browsing API.
- **Heuristic Fallback Engine**: RFC 1918 private IP filtering, known C2 heuristic indicators, and local memory caching with TTL.
- **Outbound Webhooks**: Instant notification dispatch to Microsoft Teams and Slack for High and Critical severity incidents.

### 11. Threat Insight RSS & Cyber Intelligence Feeds
- **Multi-Feed Ingestion**: Live XML RSS 2.0 and Atom 1.0 parser for CISA Alerts, CERT-SE, SANS Internet Storm Center, and Microsoft Security Guidance.
- **Automated CVE Extraction**: Automatically detects and indexes CVE identifiers from feed text and links them directly to the NIST NVD vulnerability database.

### 12. Enterprise RBAC & Dual Authentication
- **Dual Authentication Modes**: Seamless Microsoft Entra ID SSO (OAuth2 PKCE) alongside secure local administrative authentication.
- **Role-Based Access Control (RBAC)**: `ADMIN`, `ANALYST`, and `READONLY` access levels.
- **Password Security**: Unique per-user random cryptographic salt with PBKDF2 HMAC-SHA512 hashing, brute-force protection, and self-service password reset.

### 13. Production Demo Mode Safeguard
- **Environment Protection**: Easily toggle between demonstration/staging datasets and live production data.
- **Safe by Default**: When configured with `DEMO_MODE=false`, demo reset endpoints (`/api/demo/reset`) return `HTTP 403 Forbidden`, and UI reset buttons are automatically hidden.

---

## Quick Start with Docker Compose

Deploy the complete platform (frontend + backend + persistent volume) with a single command:

```bash
# Clone the repository
git clone https://github.com/MaxVonk/mSec.git
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
APP_URL=https://security.example.com

# Domain name for SSL certificate
DOMAIN=security.example.com

# Let's Encrypt registration email
CERTBOT_EMAIL=admin@example.com

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

### 4. Automated Certificate Renewals

Once bootstrapped, run the full stack:

```bash
docker compose up -d
```

The background `certbot` container checks for renewal every 12 hours. Nginx periodically reloads to seamlessly pick up renewed certificates without downtime.

---

## Local Development

Prerequisites: Node.js 22+ or 24+ and npm.

```bash
# Install dependencies
npm install

# Run backend API (port 3310) and Vite frontend (port 5173) concurrently in Sandboxed Demo Mode
npm run demo
# or: npm run dev

# Run automated unit test suite
npm test

# Build production bundle
npm run build

# Start production server
npm start
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
| `NODE_ENV` | `development` | Node environment (`production` / `development`) |
| `DEMO_MODE` | `true` in dev | Set to `true` to enable demo dataset resets in staging/demo |
| `M365_TENANT_ID` | *(optional)* | Microsoft 365 / Entra Directory (Tenant) ID |
| `M365_CLIENT_ID` | *(optional)* | App Registration (Client) ID with Graph Security permissions |
| `M365_CLIENT_SECRET`| *(optional)* | App Registration Client Secret |
| `SENTINEL_SUBSCRIPTION_ID` | *(optional)* | Azure Subscription ID containing Sentinel workspace |
| `SENTINEL_RESOURCE_GROUP` | *(optional)* | Azure Resource Group containing Sentinel workspace |
| `SENTINEL_WORKSPACE_NAME` | *(optional)* | Azure Log Analytics / Sentinel Workspace name |
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

### Verified Test Suites (96 passing tests across 30 suites):
- ✅ **PhishPilot Quishing & QR Forensics**: Barcode buffer decoding, attachment extraction, inline HTML base64 detection, risk scoring.
- ✅ **Native SQLite Persistence**: WAL mode database initialization, transactional batch incident persistence, connector configs, and report caching.
- ✅ **Bidirectional Cloud Sync**: Microsoft Graph Security update formatting, Azure Sentinel classification/comment dispatch, and local simulation fallbacks.
- ✅ **Normalization**: M365 Defender XDR, Sentinel SIEM, Entra ID risky sign-ins.
- ✅ **PhishPilot Forensics**: RFC 822 parser, SPF/DKIM/DMARC analysis, Homoglyph detector, STIX 2.1 generator.
- ✅ **SOAR Playbooks**: Rapid-containment runbook definitions and sequential execution.
- ✅ **Incident Correlator**: Cross-provider duplicate pairing and unified chaining.
- ✅ **Threat Insight Feeds**: RSS 2.0 / Atom 1.0 parser and CVE auto-extraction.
- ✅ **Authentication & UserStore**: Salt/hash security, RBAC enforcement, session management.
- ✅ **Operations & Services**: Ingestion scheduler, webhook notifier, threat intelligence engine, shift handover reports, and production demo mode switch.
