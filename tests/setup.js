// Test setup and configuration
const dotenv = require('dotenv');

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Global test configuration
global.testConfig = {
  apiUrl: process.env.TEST_API_URL || 'http://localhost:8080',
  timeout: 10000,
  retries: 2,
};

// Mock Firebase Admin SDK for tests
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  auth: jest.fn(() => ({
    verifyIdToken: jest.fn().mockResolvedValue({
      uid: 'test-user-123',
      email: 'test@example.com',
      email_verified: true,
    }),
    getUser: jest.fn().mockResolvedValue({
      uid: 'test-user-123',
      email: 'test@example.com',
      customClaims: {},
    }),
  })),
  apps: [],
}));

// Mock Google Cloud services
jest.mock('@google-cloud/vision', () => ({
  ImageAnnotatorClient: jest.fn().mockImplementation(() => ({
    textDetection: jest.fn().mockResolvedValue([{
      textAnnotations: [
        { description: 'SUPERMERCADO TEST\n2024-01-15\nTotal: 45.67€' },
        { description: 'SUPERMERCADO TEST' },
        { description: '2024-01-15' },
        { description: 'Total: 45.67€' },
      ],
    }]),
  })),
}));

jest.mock('@google-cloud/storage', () => ({
  Storage: jest.fn().mockImplementation(() => ({
    bucket: jest.fn().mockReturnValue({
      file: jest.fn().mockReturnValue({
        save: jest.fn().mockResolvedValue(),
        getSignedUrl: jest.fn().mockResolvedValue(['https://example.com/test-receipt.jpg']),
      }),
      exists: jest.fn().mockResolvedValue([true]),
    }),
  })),
}));

jest.mock('@google-cloud/firestore', () => ({
  Firestore: jest.fn().mockImplementation(() => ({
    collection: jest.fn().mockReturnValue({
      add: jest.fn().mockResolvedValue({ id: 'test-doc-id' }),
      doc: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({
          exists: true,
          id: 'test-doc-id',
          data: jest.fn().mockReturnValue({
            vendor: 'Test Vendor',
            total: 45.67,
            userId: 'test-user-123',
          }),
        }),
        update: jest.fn().mockResolvedValue(),
        delete: jest.fn().mockResolvedValue(),
      }),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({
        empty: false,
        size: 1,
        forEach: jest.fn().mockImplementation((callback) => {
          callback({
            id: 'test-doc-id',
            data: () => ({
              vendor: 'Test Vendor',
              total: 45.67,
              userId: 'test-user-123',
              createdAt: new Date(),
            }),
          });
        }),
      }),
    }),
    runTransaction: jest.fn().mockImplementation((callback) => callback({
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({ totalSpent: 100, totalReceipts: 5 }),
      }),
      update: jest.fn(),
    })),
  })),
}));

// Setup and teardown
beforeAll(async () => {
  // Global setup
  console.log('🧪 Setting up test environment...');
});

afterAll(async () => {
  // Global cleanup
  console.log('🧹 Cleaning up test environment...');
});

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});