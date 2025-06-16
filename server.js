const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Initialize services (will be implemented)
// const visionService = require('./services/vision');
// const firestoreService = require('./services/firestore');

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
app.post('/api/receipts/upload', upload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // TODO: Process with Vision API
    // const ocrResult = await visionService.extractText(req.file.buffer);
    // const parsedData = await visionService.parseReceiptData(ocrResult);
    // const savedReceipt = await firestoreService.saveReceipt(parsedData);

    // Mock response for now
    const mockReceipt = {
      id: Date.now().toString(),
      uploadedAt: new Date().toISOString(),
      filename: req.file.originalname,
      status: 'processing',
      extractedData: {
        vendor: 'Supermercado Example',
        date: new Date().toISOString().split('T')[0],
        total: 45.67,
        items: [
          { name: 'Producto 1', price: 12.50 },
          { name: 'Producto 2', price: 33.17 }
        ]
      }
    };

    res.json({
      success: true,
      receipt: mockReceipt
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to process receipt' });
  }
});

// Get all receipts
app.get('/api/receipts', async (req, res) => {
  try {
    // TODO: Fetch from Firestore
    // const receipts = await firestoreService.getReceipts(req.query);
    
    // Mock response
    const mockReceipts = [
      {
        id: '1',
        vendor: 'Supermercado A',
        date: '2024-01-15',
        total: 125.50,
        category: 'Alimentación'
      },
      {
        id: '2',
        vendor: 'Gasolinera B',
        date: '2024-01-14',
        total: 60.00,
        category: 'Transporte'
      }
    ];

    res.json({
      receipts: mockReceipts,
      total: mockReceipts.length
    });
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch receipts' });
  }
});

// Get analytics
app.get('/api/analytics', async (req, res) => {
  try {
    // TODO: Calculate from Firestore data
    // const analytics = await firestoreService.getAnalytics(req.query);
    
    // Mock analytics
    const mockAnalytics = {
      period: req.query.period || 'month',
      totalSpent: 1250.75,
      averageDaily: 41.69,
      topCategories: [
        { name: 'Alimentación', amount: 650.50, percentage: 52 },
        { name: 'Transporte', amount: 350.25, percentage: 28 },
        { name: 'Servicios', amount: 250.00, percentage: 20 }
      ],
      trend: {
        current: 1250.75,
        previous: 1180.50,
        change: 5.95
      }
    };

    res.json(mockAnalytics);
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get categories
app.get('/api/categories', (req, res) => {
  res.json({
    categories: [
      { id: '1', name: 'Alimentación', icon: '🛒', color: '#10B981' },
      { id: '2', name: 'Transporte', icon: '🚗', color: '#3B82F6' },
      { id: '3', name: 'Servicios', icon: '💡', color: '#F59E0B' },
      { id: '4', name: 'Salud', icon: '🏥', color: '#EF4444' },
      { id: '5', name: 'Entretenimiento', icon: '🎬', color: '#8B5CF6' },
      { id: '6', name: 'Hogar', icon: '🏠', color: '#EC4899' },
      { id: '7', name: 'Otros', icon: '📦', color: '#6B7280' }
    ]
  });
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