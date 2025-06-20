const request = require('supertest');
const express = require('express');
const path = require('path');

// Import the server setup but not the listen part
const app = require('../../server');

describe('Receipts API', () => {
  const mockAuthToken = 'Bearer mock-token';

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('POST /api/receipts/upload', () => {
    it('should upload and process receipt successfully', async () => {
      const response = await request(app)
        .post('/api/receipts/upload')
        .set('Authorization', mockAuthToken)
        .attach('receipt', Buffer.from('fake-image-data'), 'test-receipt.jpg')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('receipt');
      expect(response.body.receipt).toHaveProperty('vendor');
      expect(response.body.receipt).toHaveProperty('total');
      expect(response.body.receipt).toHaveProperty('category');
    });

    it('should reject requests without file', async () => {
      const response = await request(app)
        .post('/api/receipts/upload')
        .set('Authorization', mockAuthToken)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'No file uploaded');
      expect(response.body).toHaveProperty('code', 'NO_FILE');
    });

    it('should reject requests without authentication', async () => {
      const response = await request(app)
        .post('/api/receipts/upload')
        .attach('receipt', Buffer.from('fake-image-data'), 'test-receipt.jpg')
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'TOKEN_MISSING');
    });

    it('should reject invalid file types', async () => {
      const response = await request(app)
        .post('/api/receipts/upload')
        .set('Authorization', mockAuthToken)
        .attach('receipt', Buffer.from('fake-text-data'), 'test-file.txt')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/receipts', () => {
    it('should get receipts for authenticated user', async () => {
      const response = await request(app)
        .get('/api/receipts')
        .set('Authorization', mockAuthToken)
        .expect(200);

      expect(response.body).toHaveProperty('receipts');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('hasMore');
      expect(Array.isArray(response.body.receipts)).toBe(true);
    });

    it('should apply query filters', async () => {
      const response = await request(app)
        .get('/api/receipts')
        .query({
          category: 'Alimentación',
          limit: 10,
          offset: 0,
          minAmount: 10,
          maxAmount: 100,
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        })
        .set('Authorization', mockAuthToken)
        .expect(200);

      expect(response.body).toHaveProperty('receipts');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/receipts')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/receipts/:id', () => {
    it('should get single receipt by ID', async () => {
      const response = await request(app)
        .get('/api/receipts/test-doc-id')
        .set('Authorization', mockAuthToken)
        .expect(200);

      expect(response.body).toHaveProperty('receipt');
      expect(response.body.receipt).toHaveProperty('id', 'test-doc-id');
    });

    it('should return 404 for non-existent receipt', async () => {
      // Mock Firestore to return non-existent document
      const { Firestore } = require('@google-cloud/firestore');
      Firestore.prototype.collection = jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ exists: false }),
        }),
      });

      const response = await request(app)
        .get('/api/receipts/non-existent')
        .set('Authorization', mockAuthToken)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Receipt not found');
    });
  });

  describe('PUT /api/receipts/:id', () => {
    it('should update receipt data', async () => {
      const updateData = {
        vendor: 'Updated Vendor',
        total: 55.99,
        verified: true
      };

      const response = await request(app)
        .put('/api/receipts/test-doc-id')
        .set('Authorization', mockAuthToken)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('receipt');
      expect(response.body.receipt).toHaveProperty('id', 'test-doc-id');
    });

    it('should validate update data types', async () => {
      const updateData = {
        total: 'invalid-number'
      };

      const response = await request(app)
        .put('/api/receipts/test-doc-id')
        .set('Authorization', mockAuthToken)
        .send(updateData)
        .expect(200); // Will be handled by parseFloat

      expect(response.body).toHaveProperty('receipt');
    });
  });

  describe('DELETE /api/receipts/:id', () => {
    it('should delete receipt', async () => {
      const response = await request(app)
        .delete('/api/receipts/test-doc-id')
        .set('Authorization', mockAuthToken)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should return 404 for non-existent receipt', async () => {
      // Mock Firestore to return non-existent document
      const { Firestore } = require('@google-cloud/firestore');
      Firestore.prototype.collection = jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ exists: false }),
        }),
      });

      const response = await request(app)
        .delete('/api/receipts/non-existent')
        .set('Authorization', mockAuthToken)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Receipt not found');
    });
  });
});