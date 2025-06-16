#!/bin/bash

# Deploy NubemDom to Google Cloud Run
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🚀 Deploying NubemDom to Google Cloud Run${NC}"
echo "=================================================="

# Configuration
PROJECT_ID="nubemdom"
REGION="us-central1"
SERVICE_NAME="nubemdom"

# Ensure we're using the correct project
echo -e "\n${YELLOW}Setting GCP project...${NC}"
gcloud config set project ${PROJECT_ID}

# Build and deploy using Cloud Build
echo -e "\n${YELLOW}Building and deploying with Cloud Build...${NC}"
gcloud builds submit --config cloudbuild.yaml .

# Get the service URL
echo -e "\n${YELLOW}Getting service URL...${NC}"
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
  --region ${REGION} \
  --format='value(status.url)')

echo -e "\n${GREEN}✅ NubemDom deployed successfully!${NC}"
echo -e "\n${BLUE}📊 Service URL: ${SERVICE_URL}${NC}"

# Test the deployment
echo -e "\n${YELLOW}Testing deployment...${NC}"
sleep 10
curl -s "${SERVICE_URL}/health" | jq '.' || echo "jq not installed, testing with curl only"

# Test basic endpoints
echo -e "\n${YELLOW}Testing API endpoints...${NC}"
echo "Health check:"
curl -s "${SERVICE_URL}/health"
echo -e "\n\nAPI Info:"
curl -s "${SERVICE_URL}/"

echo -e "\n\n${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "\n${BLUE}Next steps:${NC}"
echo "1. Configure environment variables in Cloud Run console"
echo "2. Set up Cloud Vision API integration"
echo "3. Configure Firestore database"
echo "4. Test OCR functionality"
echo -e "\n${BLUE}Access your application at: ${SERVICE_URL}${NC}"