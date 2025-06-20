require('dotenv').config();

const config = {
  // Environment
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 8080,
  
  // Google Cloud Platform
  projectId: process.env.PROJECT_ID || 'nubemdom',
  
  // Firebase
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.PROJECT_ID || 'nubemdom',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY ? 
      process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
    serviceAccountPath: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  },
  
  // Storage
  storage: {
    bucket: process.env.STORAGE_BUCKET || `${process.env.PROJECT_ID || 'nubemdom'}-receipts`,
  },
  
  // CORS
  cors: {
    origin: process.env.FRONTEND_URL ? 
      process.env.FRONTEND_URL.split(',').map(url => url.trim()) : 
      ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  },
  
  // API
  api: {
    baseUrl: process.env.API_BASE_URL || 'http://localhost:8080',
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  },
  
  // File Upload
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 10 * 1024 * 1024, // 10MB
    allowedTypes: process.env.ALLOWED_FILE_TYPES ? 
      process.env.ALLOWED_FILE_TYPES.split(',').map(type => type.trim()) :
      ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'],
  },
  
  // OCR Configuration
  ocr: {
    confidenceThreshold: parseFloat(process.env.OCR_CONFIDENCE_THRESHOLD) || 0.8,
    autoCategorization: process.env.AUTO_CATEGORIZATION === 'true',
  },
  
  // Database
  database: {
    collectionPrefix: process.env.FIRESTORE_COLLECTION_PREFIX || 
      (process.env.NODE_ENV === 'production' ? 'prod' : 'dev'),
  },
  
  // Security
  security: {
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "https:"],
        },
      },
    },
  },
  
  // Health Check
  health: {
    checkInterval: 30000, // 30 seconds
  },
};

// Validation
const requiredEnvVars = [];

if (config.nodeEnv === 'production') {
  requiredEnvVars.push('PROJECT_ID');
}

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}

// Validate Firebase configuration
if (config.nodeEnv === 'production') {
  if (!config.firebase.clientEmail && !config.firebase.serviceAccountPath) {
    console.warn('Warning: No Firebase credentials configured. Authentication will not work.');
  }
}

module.exports = config;