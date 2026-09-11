#!/usr/bin/env bash
# ==============================================================================
# mSec - Automated Microsoft Entra ID (Single-Tenant) Setup Script for Linux
# ==============================================================================
# This script automates:
# 1. Tenant Admin authentication via Azure CLI (supports headless device-code)
# 2. Creating a Single-Tenant App Registration ("mSec-Security-Platform")
# 3. Provisioning the Enterprise Application (Service Principal)
# 4. Assigning Microsoft Graph permissions (M365 Defender, Alerts, Entra Sign-ins, Mail)
# 5. Granting tenant-wide Admin Consent
# 6. Generating a secure Client Secret
# 7. Writing credentials directly into .env and .msec_data/connectors.json
# ==============================================================================

set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}${BOLD}"
echo "=========================================================="
echo "    mSec - Microsoft Entra Single-Tenant Setup (Linux)    "
echo "=========================================================="
echo -e "${NC}"

# 1. Check Azure CLI installation
if ! command -v az &>/dev/null; then
  echo -e "${RED}[ERROR] Azure CLI ('az') is not installed.${NC}"
  echo "Please install it on your Linux distribution before running this script:"
  echo "  Ubuntu/Debian: curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash"
  echo "  RHEL/CentOS:   sudo rpm --import https://packages.microsoft.com/keys/microsoft.asc && sudo dnf install azure-cli"
  echo "  Arch Linux:    sudo pacman -S azure-cli"
  exit 1
fi

# 2. Check jq installation
if ! command -v jq &>/dev/null; then
  echo -e "${YELLOW}[NOTICE] 'jq' is not installed. Installing or using fallback...${NC}"
  if command -v apt-get &>/dev/null; then
    sudo apt-get update -qq && sudo apt-get install -y -qq jq >/dev/null 2>&1 || true
  fi
fi

# 3. Authenticate with Azure CLI
echo -e "${CYAN}[1/6] Checking Azure CLI authentication...${NC}"
CURRENT_ACCOUNT=$(az account show 2>/dev/null || true)

if [ -z "$CURRENT_ACCOUNT" ]; then
  echo -e "${YELLOW}Not logged in. Starting device code login...${NC}"
  echo -e "Open the URL shown below in any browser (phone or desktop) and enter the code:"
  az login --use-device-code
fi

TENANT_ID=$(az account show --query tenantId -o tsv)
TENANT_NAME=$(az rest --method get --url "https://graph.microsoft.com/v1.0/organization" --query "value[0].displayName" -o tsv 2>/dev/null || echo "Your Tenant")

echo -e "${GREEN}✓ Connected to Tenant:${NC} ${BOLD}${TENANT_NAME}${NC} (${TENANT_ID})"

# Prompt for App Name
APP_NAME="${APP_NAME:-mSec-Security-Platform}"
read -rp "App Registration Name [$APP_NAME]: " INPUT_APP_NAME
APP_NAME="${INPUT_APP_NAME:-$APP_NAME}"

# Prompt for local network binding / redirect URIs
read -rp "Local IP or hostname for callback (press Enter for 'localhost'): " LOCAL_HOST
LOCAL_HOST="${LOCAL_HOST:-localhost}"

REDIRECT_URIS=(
  "http://localhost:3310/api/auth/callback"
  "http://127.0.0.1:3310/api/auth/callback"
  "http://localhost:5173/api/auth/callback"
)

if [ "$LOCAL_HOST" != "localhost" ] && [ "$LOCAL_HOST" != "127.0.0.1" ]; then
  REDIRECT_URIS+=("http://${LOCAL_HOST}:3310/api/auth/callback")
fi

echo -e "\n${CYAN}[2/6] Registering Single-Tenant Application '${APP_NAME}'...${NC}"

# Check if application already exists
EXISTING_APP_ID=$(az ad app list --display-name "$APP_NAME" --query "[0].appId" -o tsv 2>/dev/null || true)

if [ -n "$EXISTING_APP_ID" ]; then
  echo -e "${YELLOW}Existing application found with Client ID: ${EXISTING_APP_ID}${NC}"
  APP_ID="$EXISTING_APP_ID"
else
  # Create single tenant application
  APP_ID=$(az ad app create \
    --display-name "$APP_NAME" \
    --sign-in-audience AzureADMyOrg \
    --web-redirect-uris "${REDIRECT_URIS[@]}" \
    --query appId -o tsv)
  echo -e "${GREEN}✓ Created App Registration with Client ID: ${APP_ID}${NC}"
fi

# 4. Create Service Principal (Enterprise Application)
echo -e "\n${CYAN}[3/6] Ensuring Enterprise Application (Service Principal) exists...${NC}"
SP_ID=$(az ad sp list --filter "appId eq '$APP_ID'" --query "[0].id" -o tsv 2>/dev/null || true)

if [ -z "$SP_ID" ]; then
  SP_ID=$(az ad sp create --id "$APP_ID" --query id -o tsv)
  echo -e "${GREEN}✓ Enterprise Application created (Service Principal ID: ${SP_ID})${NC}"
else
  echo -e "${GREEN}✓ Enterprise Application already exists (Service Principal ID: ${SP_ID})${NC}"
fi

# 5. Configure Microsoft Graph API permissions
echo -e "\n${CYAN}[4/6] Configuring Microsoft Graph permissions...${NC}"
GRAPH_APP_ID="00000003-0000-0000-c000-000000000000"

# Application permissions needed for backend ingestion
APP_ROLES=(
  "SecurityIncident.Read.All"
  "SecurityAlert.Read.All"
  "AuditLog.Read.All"
  "IdentityRiskyUser.Read.All"
  "IdentityRiskEvent.Read.All"
  "Organization.Read.All"
  "Mail.Read"
)

# Delegated permissions for user login
DELEGATED_SCOPES=(
  "User.Read"
  "offline_access"
  "openid"
  "profile"
)

# Fetch Microsoft Graph roles and scopes
echo "Fetching Microsoft Graph permission IDs..."
GRAPH_SP_JSON=$(az ad sp show --id "$GRAPH_APP_ID" 2>/dev/null)

ROLE_IDS=()
for role in "${APP_ROLES[@]}"; do
  ID=$(echo "$GRAPH_SP_JSON" | jq -r ".appRoles[] | select(.value == \"$role\") | .id" 2>/dev/null || true)
  if [ -n "$ID" ] && [ "$ID" != "null" ]; then
    ROLE_IDS+=("${ID}=Role")
  fi
done

SCOPE_IDS=()
for scope in "${DELEGATED_SCOPES[@]}"; do
  ID=$(echo "$GRAPH_SP_JSON" | jq -r ".oauth2PermissionScopes[] | select(.value == \"$scope\") | .id" 2>/dev/null || true)
  if [ -n "$ID" ] && [ "$ID" != "null" ]; then
    SCOPE_IDS+=("${ID}=Scope")
  fi
done

ALL_PERMS=("${ROLE_IDS[@]}" "${SCOPE_IDS[@]}")

echo "Adding ${#ALL_PERMS[@]} permissions to App Registration..."
az ad app permission add \
  --id "$APP_ID" \
  --api "$GRAPH_APP_ID" \
  --api-permissions "${ALL_PERMS[@]}" >/dev/null

echo -e "${GREEN}✓ Added Microsoft Graph permissions.${NC}"

# Grant Admin Consent
echo -e "\n${CYAN}[5/6] Granting tenant-wide Admin Consent...${NC}"
az ad app permission admin-consent --id "$APP_ID"
echo -e "${GREEN}✓ Admin Consent granted successfully for tenant ${TENANT_ID}.${NC}"

# 6. Generate Client Secret
echo -e "\n${CYAN}[6/6] Generating client secret...${NC}"
CLIENT_SECRET=$(az ad app credential reset \
  --id "$APP_ID" \
  --append \
  --display-name "mSec-Local-Office-Secret" \
  --years 2 \
  --query password -o tsv)

echo -e "${GREEN}✓ Client secret created (valid for 2 years).${NC}"

# Write to .env
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

# Preserve existing .env content or create new
if [ ! -f "$ENV_FILE" ]; then
  if [ -f "${SCRIPT_DIR}/.env.example" ]; then
    cp "${SCRIPT_DIR}/.env.example" "$ENV_FILE"
  else
    touch "$ENV_FILE"
  fi
fi

# Helper function to update or append .env key
update_env() {
  local key="$1"
  local val="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

update_env "PORT" "3310"
update_env "M365_TENANT_ID" "$TENANT_ID"
update_env "M365_CLIENT_ID" "$APP_ID"
update_env "M365_CLIENT_SECRET" "$CLIENT_SECRET"
update_env "GRAPH_TENANT_ID" "$TENANT_ID"
update_env "GRAPH_CLIENT_ID" "$APP_ID"
update_env "GRAPH_CLIENT_SECRET" "$CLIENT_SECRET"

# Set permissions on .env (read/write only by owner)
chmod 600 "$ENV_FILE"

# Pre-populate .msec_data/connectors.json
DATA_DIR="${SCRIPT_DIR}/.msec_data"
mkdir -p "$DATA_DIR"
CONNECTORS_FILE="${DATA_DIR}/connectors.json"

cat <<EOF > "$CONNECTORS_FILE"
{
  "graph": {
    "tenantId": "${TENANT_ID}",
    "clientId": "${APP_ID}",
    "clientSecret": "${CLIENT_SECRET}",
    "enabled": true,
    "status": "CONNECTED",
    "statusMessage": "Configured automatically via setup-entra.sh"
  },
  "sentinel": {
    "tenantId": "${TENANT_ID}",
    "clientId": "${APP_ID}",
    "clientSecret": "${CLIENT_SECRET}",
    "subscriptionId": "",
    "resourceGroup": "",
    "workspaceName": "",
    "workspaceId": "",
    "enabled": false,
    "status": "IDLE"
  }
}
EOF
chmod 600 "$CONNECTORS_FILE"

echo -e "\n${GREEN}${BOLD}=========================================================="
echo "           mSec Entra Integration Complete!               "
echo "==========================================================${NC}"
echo -e "Tenant ID:     ${BOLD}${TENANT_ID}${NC}"
echo -e "Client ID:     ${BOLD}${APP_ID}${NC}"
echo -e "Client Secret: ${BOLD}[Saved to .env and .msec_data/connectors.json]${NC}"
echo ""
echo -e "${YELLOW}Next Steps on your Linux machine:${NC}"
echo -e "1. Launch mSec with Docker Compose:"
echo -e "   ${BOLD}docker compose up -d --build${NC}"
echo ""
echo -e "2. Open mSec in your browser:"
echo -e "   ${BOLD}http://${LOCAL_HOST}:3310${NC}"
echo ""
echo -e "3. All incoming traffic outside your office is blocked."
echo -e "   Only outbound HTTPS (port 443) is used to communicate with Microsoft."
echo "=========================================================="

