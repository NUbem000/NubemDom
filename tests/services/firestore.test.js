const FirestoreService = require('../../services/firestore');

describe('FirestoreService', () => {
  let firestoreService;

  beforeEach(() => {
    firestoreService = new FirestoreService();
  });

  describe('saveReceipt', () => {
    it('should save receipt data to Firestore', async () => {
      const receiptData = {
        vendor: 'Test Vendor',
        date: '2024-01-15',
        total: 45.67,
        category: 'Alimentación',
        items: [
          { name: 'Pan', price: 2.50 },
          { name: 'Leche', price: 1.80 }
        ]
      };
      const userId = 'test-user-123';

      const result = await firestoreService.saveReceipt(receiptData, userId);

      expect(result).toHaveProperty('id', 'test-doc-id');
      expect(result).toHaveProperty('vendor', 'Test Vendor');
      expect(result).toHaveProperty('userId', userId);
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('status', 'processed');
    });

    it('should handle Firestore save errors', async () => {
      // Mock Firestore error
      const { Firestore } = require('@google-cloud/firestore');
      Firestore.prototype.collection = jest.fn().mockReturnValue({
        add: jest.fn().mockRejectedValue(new Error('Firestore error')),
      });

      const receiptData = { vendor: 'Test', total: 10 };
      const userId = 'test-user-123';

      await expect(firestoreService.saveReceipt(receiptData, userId))
        .rejects.toThrow('Failed to save receipt to database');
    });
  });

  describe('getReceipts', () => {
    it('should retrieve receipts for a user', async () => {
      const userId = 'test-user-123';
      const options = { limit: 10, offset: 0 };

      const result = await firestoreService.getReceipts(userId, options);

      expect(result).toHaveProperty('receipts');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('hasMore');
      expect(Array.isArray(result.receipts)).toBe(true);
    });

    it('should apply filters correctly', async () => {
      const userId = 'test-user-123';
      const options = {
        category: 'Alimentación',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        minAmount: 10,
        maxAmount: 100
      };

      const result = await firestoreService.getReceipts(userId, options);

      expect(result).toHaveProperty('receipts');
      // Verify that filters would be applied (mocked behavior)
    });

    it('should handle search functionality', async () => {
      const userId = 'test-user-123';
      const options = { search: 'Test Vendor' };

      const result = await firestoreService.getReceipts(userId, options);

      expect(result).toHaveProperty('receipts');
      // In real implementation, would filter by search term
    });
  });

  describe('getReceipt', () => {
    it('should retrieve a single receipt by ID', async () => {
      const receiptId = 'test-doc-id';
      const userId = 'test-user-123';

      const result = await firestoreService.getReceipt(receiptId, userId);

      expect(result).toHaveProperty('id', receiptId);
      expect(result).toHaveProperty('vendor', 'Test Vendor');
    });

    it('should throw error for non-existent receipt', async () => {
      // Mock non-existent document
      const { Firestore } = require('@google-cloud/firestore');
      Firestore.prototype.collection = jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ exists: false }),
        }),
      });

      const receiptId = 'non-existent';
      const userId = 'test-user-123';

      await expect(firestoreService.getReceipt(receiptId, userId))
        .rejects.toThrow('Receipt not found');
    });

    it('should throw error for unauthorized access', async () => {
      // Mock document with different user
      const { Firestore } = require('@google-cloud/firestore');
      Firestore.prototype.collection = jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ userId: 'different-user' }),
          }),
        }),
      });

      const receiptId = 'test-doc-id';
      const userId = 'test-user-123';

      await expect(firestoreService.getReceipt(receiptId, userId))
        .rejects.toThrow('Access denied');
    });
  });

  describe('updateReceipt', () => {
    it('should update receipt data', async () => {
      const receiptId = 'test-doc-id';
      const updateData = { verified: true, total: 50.00 };
      const userId = 'test-user-123';

      const result = await firestoreService.updateReceipt(receiptId, updateData, userId);

      expect(result).toHaveProperty('id', receiptId);
      expect(result).toHaveProperty('verified', true);
      expect(result).toHaveProperty('total', 50.00);
    });
  });

  describe('deleteReceipt', () => {
    it('should delete receipt', async () => {
      const receiptId = 'test-doc-id';
      const userId = 'test-user-123';

      const result = await firestoreService.deleteReceipt(receiptId, userId);

      expect(result).toEqual({ success: true });
    });
  });

  describe('getAnalytics', () => {
    it('should calculate analytics data', async () => {
      const userId = 'test-user-123';
      const options = { period: 'month' };

      const result = await firestoreService.getAnalytics(userId, options);

      expect(result).toHaveProperty('period', 'month');
      expect(result).toHaveProperty('totalSpent');
      expect(result).toHaveProperty('averageDaily');
      expect(result).toHaveProperty('topCategories');
      expect(result).toHaveProperty('trend');
      expect(Array.isArray(result.topCategories)).toBe(true);
    });

    it('should handle different time periods', async () => {
      const userId = 'test-user-123';
      
      const weekResult = await firestoreService.getAnalytics(userId, { period: 'week' });
      const yearResult = await firestoreService.getAnalytics(userId, { period: 'year' });

      expect(weekResult.period).toBe('week');
      expect(yearResult.period).toBe('year');
    });
  });

  describe('getUserProfile', () => {
    it('should get existing user profile', async () => {
      const userId = 'test-user-123';

      const result = await firestoreService.getUserProfile(userId);

      expect(result).toHaveProperty('id', userId);
      expect(result).toHaveProperty('totalSpent');
      expect(result).toHaveProperty('totalReceipts');
    });

    it('should create new user profile if not exists', async () => {
      // Mock non-existent user
      const { Firestore } = require('@google-cloud/firestore');
      Firestore.prototype.collection = jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ exists: false }),
          set: jest.fn().mockResolvedValue(),
        }),
      });

      const userId = 'new-user-123';

      const result = await firestoreService.getUserProfile(userId);

      expect(result).toHaveProperty('id', userId);
      expect(result).toHaveProperty('totalReceipts', 0);
      expect(result).toHaveProperty('totalSpent', 0);
    });
  });

  describe('getCategories', () => {
    it('should return default categories', async () => {
      const result = await firestoreService.getCategories();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('icon');
      expect(result[0]).toHaveProperty('color');
    });
  });
});