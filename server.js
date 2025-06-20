const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const multer = require('multer');
const path = require('path');
const winston = require('winston');
require('dotenv').config();

// Import services
const VisionService = require('./services/vision');
const FirestoreService = require('./services/firestore');
const { verifyToken, optionalAuth, createUserRateLimit } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 8080;

// Initialize services
const visionService = new VisionService();
const firestoreService = new FirestoreService();

// Logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'nubemdom-api' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  }
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.uid
  });
  next();
});

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG and WebP are allowed.'));
    }
  }
});

// Rate limiting
const apiRateLimit = createUserRateLimit(100, 15 * 60 * 1000); // 100 requests per 15 minutes
const uploadRateLimit = createUserRateLimit(20, 15 * 60 * 1000); // 20 uploads per 15 minutes

// Routes
app.get('/', (req, res) => {
  res.json({
    name: 'NubemDom API',
    version: '1.0.0',
    description: 'Sistema de Control de Gastos Domésticos con OCR',
    endpoints: {
      health: 'GET /health',
      upload: 'POST /api/receipts/upload',
      receipts: 'GET /api/receipts',
      analytics: 'GET /api/analytics',
      categories: 'GET /api/categories'
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'NubemDom',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Upload receipt endpoint
app.post('/api/receipts/upload', verifyToken, uploadRateLimit, upload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No file uploaded',
        code: 'NO_FILE'
      });
    }

    logger.info('Processing receipt upload', {
      userId: req.user.uid,
      filename: req.file.originalname,
      size: req.file.size
    });

    // Initialize storage bucket if needed
    await visionService.initializeBucket();

    // Save image to Cloud Storage
    const imageData = await visionService.saveReceiptImage(
      req.file.buffer, 
      req.file.originalname
    );

    // Extract text using Vision API
    const textResult = await visionService.extractText(req.file.buffer);
    
    // Parse receipt data
    const parsedData = visionService.parseReceiptData(textResult);
    
    // Add image metadata
    const receiptData = {
      ...parsedData,
      filename: req.file.originalname,
      imageUrl: imageData.url,
      imagePath: imageData.fileName,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedAt: new Date().toISOString()
    };

    // Save to Firestore
    const savedReceipt = await firestoreService.saveReceipt(receiptData, req.user.uid);

    logger.info('Receipt processed successfully', {
      userId: req.user.uid,
      receiptId: savedReceipt.id,
      vendor: savedReceipt.vendor,
      total: savedReceipt.total
    });

    res.json({
      success: true,
      receipt: savedReceipt
    });

  } catch (error) {
    logger.error('Receipt upload error', {
      userId: req.user?.uid,
      error: error.message,
      stack: error.stack
    });

    let statusCode = 500;
    let errorCode = 'PROCESSING_ERROR';
    let message = 'Failed to process receipt';

    if (error.message.includes('Vision API')) {
      errorCode = 'OCR_ERROR';
      message = 'Failed to extract text from image';
    } else if (error.message.includes('storage')) {
      errorCode = 'STORAGE_ERROR';
      message = 'Failed to save image';
    } else if (error.message.includes('database')) {
      errorCode = 'DATABASE_ERROR';
      message = 'Failed to save receipt data';
    }

    res.status(statusCode).json({ 
      error: message,
      code: errorCode
    });
  }
});

// Get all receipts
app.get('/api/receipts', verifyToken, apiRateLimit, async (req, res) => {
  try {
    const options = {
      limit: parseInt(req.query.limit) || 20,
      offset: parseInt(req.query.offset) || 0,
      category: req.query.category,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      minAmount: req.query.minAmount ? parseFloat(req.query.minAmount) : undefined,
      maxAmount: req.query.maxAmount ? parseFloat(req.query.maxAmount) : undefined,
      search: req.query.search
    };

    const result = await firestoreService.getReceipts(req.user.uid, options);

    res.json(result);
  } catch (error) {
    logger.error('Get receipts error', {
      userId: req.user.uid,
      error: error.message
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch receipts',
      code: 'FETCH_ERROR'
    });
  }
});

// Get single receipt
app.get('/api/receipts/:id', verifyToken, apiRateLimit, async (req, res) => {
  try {
    const receipt = await firestoreService.getReceipt(req.params.id, req.user.uid);
    res.json({ receipt });
  } catch (error) {
    logger.error('Get receipt error', {
      userId: req.user.uid,
      receiptId: req.params.id,
      error: error.message
    });

    if (error.message === 'Receipt not found') {
      return res.status(404).json({ 
        error: 'Receipt not found',
        code: 'NOT_FOUND'
      });
    }

    if (error.message === 'Access denied') {
      return res.status(403).json({ 
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    res.status(500).json({ 
      error: 'Failed to fetch receipt',
      code: 'FETCH_ERROR'
    });
  }
});

// Update receipt
app.put('/api/receipts/:id', verifyToken, apiRateLimit, async (req, res) => {
  try {
    const { vendor, total, category, date, items, verified } = req.body;
    
    const updateData = {};
    if (vendor !== undefined) updateData.vendor = vendor;
    if (total !== undefined) updateData.total = parseFloat(total);
    if (category !== undefined) updateData.category = category;
    if (date !== undefined) updateData.date = date;
    if (items !== undefined) updateData.items = items;
    if (verified !== undefined) updateData.verified = verified;

    const receipt = await firestoreService.updateReceipt(
      req.params.id, 
      updateData, 
      req.user.uid
    );

    logger.info('Receipt updated', {
      userId: req.user.uid,
      receiptId: req.params.id,
      updates: Object.keys(updateData)
    });

    res.json({ receipt });
  } catch (error) {
    logger.error('Update receipt error', {
      userId: req.user.uid,
      receiptId: req.params.id,
      error: error.message
    });

    if (error.message === 'Receipt not found') {
      return res.status(404).json({ 
        error: 'Receipt not found',
        code: 'NOT_FOUND'
      });
    }

    if (error.message === 'Access denied') {
      return res.status(403).json({ 
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    res.status(500).json({ 
      error: 'Failed to update receipt',
      code: 'UPDATE_ERROR'
    });
  }
});

// Delete receipt
app.delete('/api/receipts/:id', verifyToken, apiRateLimit, async (req, res) => {
  try {
    await firestoreService.deleteReceipt(req.params.id, req.user.uid);

    logger.info('Receipt deleted', {
      userId: req.user.uid,
      receiptId: req.params.id
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Delete receipt error', {
      userId: req.user.uid,
      receiptId: req.params.id,
      error: error.message
    });

    if (error.message === 'Receipt not found') {
      return res.status(404).json({ 
        error: 'Receipt not found',
        code: 'NOT_FOUND'
      });
    }

    if (error.message === 'Access denied') {
      return res.status(403).json({ 
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    res.status(500).json({ 
      error: 'Failed to delete receipt',
      code: 'DELETE_ERROR'
    });
  }
});

// Get analytics
app.get('/api/analytics', verifyToken, apiRateLimit, async (req, res) => {
  try {
    const options = {
      period: req.query.period || 'month',
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };

    const analytics = await firestoreService.getAnalytics(req.user.uid, options);
    res.json(analytics);
  } catch (error) {
    logger.error('Analytics error', {
      userId: req.user.uid,
      error: error.message
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch analytics',
      code: 'ANALYTICS_ERROR'
    });
  }
});

// Get user profile
app.get('/api/profile', verifyToken, apiRateLimit, async (req, res) => {
  try {
    const profile = await firestoreService.getUserProfile(req.user.uid);
    res.json({ profile });
  } catch (error) {
    logger.error('Profile error', {
      userId: req.user.uid,
      error: error.message
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch profile',
      code: 'PROFILE_ERROR'
    });
  }
});

// Get categories
app.get('/api/categories', optionalAuth, async (req, res) => {
  try {
    const categories = await firestoreService.getCategories();
    res.json({ categories });
  } catch (error) {
    logger.error('Categories error', {
      userId: req.user?.uid,
      error: error.message
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch categories',
      code: 'CATEGORIES_ERROR'
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }
  }
  res.status(500).json({ error: error.message || 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 NubemDom server running on port ${PORT}`);
  console.log(`📊 Ready to process your receipts!`);
});