# mSec - M365 Security & SIEM Ingestion Platform

A unified security operations application to import, normalize, and analyze data from **Microsoft 365 Defender (XDR)**, **Microsoft Sentinel (SIEM)**, and **Microsoft Entra ID**, augmented with automated threat assessments based on the [Threat Oversight Agent](.github/agents/threat-oversight.agent.md).

---

## Quick Start with Docker Compose

Ensure Docker and Docker Compose are installed, then run:

```bash
# Build and launch the container
docker compose up -d
```

Open your browser at:
**[http://localhost:3310](http://localhost:3310)**

To view logs or stop the container:
```bash
docker compose logs -f
docker compose down
```

---

## Local Development (Without Docker)

```bash
# Install dependencies
npm install

# Run backend API and Vite frontend concurrently
npm run dev

# Run unit tests
npm test
```

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3310`

---

## Key Features

1. **Multi-Source Ingestion**:
   - **M365 Defender XDR**: Live Microsoft Graph Security API (`/v1.0/security/incidents` and `/alerts_v2`).
   - **Microsoft Sentinel SIEM**: Azure Resource Manager REST API for Sentinel incidents and Log Analytics workspaces.
   - **Microsoft Entra ID**: Ingestion of risky sign-in audits and anomalous authentications.
   - **Offline File Upload**: Drag-and-drop support for `.json` and `.csv` exports.
2. **Normalized Data Model**: Standardizes alerts, severities, MITRE ATT&CK techniques, and correlated entities (Users, Endpoints, IPs, Files, Cloud Resources).
3. **Threat Oversight**: Automated security review assessing trust boundaries, attack scenarios, and executing one-click containment actions (e.g. revoke refresh tokens, isolate endpoint, block IP).
4. **Data Persistence**: Data is preserved across container restarts in the `msec_data` volume.

