#!/bin/bash
# =============================================================
# GemStock — Azure one-time setup script
# Run this in Azure Cloud Shell OR locally with Azure CLI logged in
#   az login --username mr.vineet125@gmail.com
# =============================================================

set -e

# ── Config ────────────────────────────────────────────────────
RESOURCE_GROUP="gemstock-rg"
LOCATION="centralindia"
APP_NAME="gemstone-inventory"
APP_SERVICE_PLAN="gemstock-plan"
STORAGE_ACCOUNT="gemstockstorage$(date +%s | tail -c 5)"   # unique suffix
STORAGE_CONTAINER="gem-images"
NODE_VERSION="20-lts"

echo "=== Creating Resource Group ==="
az group create --name "$RESOURCE_GROUP" --location "$LOCATION"

echo "=== Creating Storage Account (for images) ==="
az storage account create \
  --name "$STORAGE_ACCOUNT" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --sku Standard_LRS \
  --kind StorageV2 \
  --allow-blob-public-access true

echo "=== Creating Blob Container ==="
az storage container create \
  --name "$STORAGE_CONTAINER" \
  --account-name "$STORAGE_ACCOUNT" \
  --public-access blob

echo "=== Getting Storage Connection String ==="
STORAGE_CONN=$(az storage account show-connection-string \
  --name "$STORAGE_ACCOUNT" \
  --resource-group "$RESOURCE_GROUP" \
  --query connectionString -o tsv)
echo "AZURE_STORAGE_CONNECTION_STRING=$STORAGE_CONN"

echo "=== Creating App Service Plan (Linux B1) ==="
az appservice plan create \
  --name "$APP_SERVICE_PLAN" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --is-linux \
  --sku B1

echo "=== Creating Web App ==="
az webapp create \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --plan "$APP_SERVICE_PLAN" \
  --runtime "NODE:$NODE_VERSION"

echo "=== Configuring App Settings ==="
# Replace placeholder values below with your real secrets before running
az webapp config appsettings set \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --settings \
    NODE_ENV="production" \
    NEXTAUTH_URL="https://${APP_NAME}.azurewebsites.net" \
    NEXTAUTH_SECRET="REPLACE_WITH_YOUR_SECRET" \
    AUTH_SECRET="REPLACE_WITH_YOUR_SECRET" \
    DATABASE_URL="REPLACE_WITH_YOUR_NEON_URL" \
    AZURE_STORAGE_CONNECTION_STRING="$STORAGE_CONN" \
    AZURE_STORAGE_CONTAINER="$STORAGE_CONTAINER" \
    NEXT_PUBLIC_APP_URL="https://${APP_NAME}.azurewebsites.net" \
    NEXT_PUBLIC_APP_NAME="GemStock" \
    WEBSITE_RUN_FROM_PACKAGE="1" \
    SCM_DO_BUILD_DURING_DEPLOYMENT="false"

echo "=== Setting startup command ==="
az webapp config set \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --startup-file "node server.js"

echo ""
echo "==================================================================="
echo "DONE. Your app URL: https://${APP_NAME}.azurewebsites.net"
echo ""
echo "Next steps:"
echo "1. Copy the AZURE_STORAGE_CONNECTION_STRING printed above"
echo "2. Get the publish profile:"
echo "   az webapp deployment list-publishing-profiles \\"
echo "     --name $APP_NAME --resource-group $RESOURCE_GROUP \\"
echo "     --xml --output tsv"
echo ""
echo "3. Add these GitHub Secrets at:"
echo "   https://github.com/vineet125/gemstone_inventory_maanagement/settings/secrets/actions"
echo ""
echo "   AZURE_WEBAPP_PUBLISH_PROFILE  → paste the XML from step 2"
echo "   DATABASE_URL                  → your Neon connection string"
echo "   NEXTAUTH_SECRET               → your secret key"
echo "   AUTH_SECRET                   → same as NEXTAUTH_SECRET"
echo "   NEXTAUTH_URL                  → https://${APP_NAME}.azurewebsites.net"
echo "   AZURE_STORAGE_CONNECTION_STRING → from step 1"
echo "   AZURE_STORAGE_CONTAINER       → gem-images"
echo "==================================================================="
