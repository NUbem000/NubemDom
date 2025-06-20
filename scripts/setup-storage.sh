#!/bin/bash

# Setup Cloud Storage for NubemDom
set -e

PROJECT_ID="nubemdom"
BUCKET_NAME="nubemdom-receipts"
SERVICE_ACCOUNT="nubemdom-sa@${PROJECT_ID}.iam.gserviceaccount.com"

echo "🗄️ Setting up Cloud Storage for NubemDom..."

# Create lifecycle policy file
cat > lifecycle.json << 'EOF'
{
  "rule": [
    {
      "action": {"type": "SetStorageClass", "storageClass": "NEARLINE"},
      "condition": {"age": 30}
    },
    {
      "action": {"type": "SetStorageClass", "storageClass": "COLDLINE"},
      "condition": {"age": 90}
    },
    {
      "action": {"type": "Delete"},
      "condition": {"age": 2555}
    }
  ]
}
EOF

# Check if bucket already exists
if gsutil ls -b gs://${BUCKET_NAME} >/dev/null 2>&1; then
    echo "✅ Bucket ${BUCKET_NAME} already exists"
else
    echo "📦 Creating bucket ${BUCKET_NAME}..."
    gsutil mb -p ${PROJECT_ID} -c STANDARD -l us-central1 gs://${BUCKET_NAME}
fi

# Set lifecycle policy
echo "⏰ Setting lifecycle policy..."
gsutil lifecycle set lifecycle.json gs://${BUCKET_NAME}

# Grant permissions to service account
echo "🔐 Granting permissions to service account..."
gsutil iam ch serviceAccount:${SERVICE_ACCOUNT}:objectAdmin gs://${BUCKET_NAME}

# Set CORS policy for web uploads
echo "🌐 Setting CORS policy..."
cat > cors.json << 'EOF'
[
  {
    "origin": ["*"],
    "method": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "responseHeader": ["Content-Type", "Access-Control-Allow-Origin"],
    "maxAgeSeconds": 3600
  }
]
EOF

gsutil cors set cors.json gs://${BUCKET_NAME}

# Set default object ACL
echo "🔒 Setting default object ACL..."
gsutil defacl set private gs://${BUCKET_NAME}

# Clean up temporary files
rm -f lifecycle.json cors.json

echo "✅ Cloud Storage setup completed!"
echo "📍 Bucket: gs://${BUCKET_NAME}"
echo "🔗 Service Account: ${SERVICE_ACCOUNT}"