const { Firestore } = require('@google-cloud/firestore');

class FirestoreService {
  constructor() {
    this.db = new Firestore({
      projectId: process.env.PROJECT_ID || 'nubemdom'
    });
    
    // Collection names
    this.collections = {
      receipts: 'receipts',
      users: 'users',
      categories: 'categories',
      budgets: 'budgets',
      analytics: 'analytics'
    };
  }

  /**
   * Save receipt data to Firestore
   */
  async saveReceipt(receiptData, userId) {
    try {
      const receipt = {
        ...receiptData,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'processed',
        verified: false
      };

      const docRef = await this.db.collection(this.collections.receipts).add(receipt);
      
      // Update user statistics
      await this.updateUserStats(userId, receiptData.total, receiptData.category);
      
      return {
        id: docRef.id,
        ...receipt
      };
    } catch (error) {
      console.error('Firestore save error:', error);
      throw new Error('Failed to save receipt to database');
    }
  }

  /**
   * Get receipts for a user with pagination and filters
   */
  async getReceipts(userId, options = {}) {
    try {
      const {
        limit = 20,
        offset = 0,
        category,
        startDate,
        endDate,
        minAmount,
        maxAmount,
        search
      } = options;

      let query = this.db.collection(this.collections.receipts)
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc');

      // Apply filters
      if (category) {
        query = query.where('category', '==', category);
      }

      if (startDate) {
        query = query.where('date', '>=', startDate);
      }

      if (endDate) {
        query = query.where('date', '<=', endDate);
      }

      if (minAmount) {
        query = query.where('total', '>=', minAmount);
      }

      if (maxAmount) {
        query = query.where('total', '<=', maxAmount);
      }

      // Execute query
      const snapshot = await query.limit(limit).offset(offset).get();
      const receipts = [];

      snapshot.forEach(doc => {
        receipts.push({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
          updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt
        });
      });

      // Apply text search if needed (client-side filtering)
      let filteredReceipts = receipts;
      if (search) {
        const searchLower = search.toLowerCase();
        filteredReceipts = receipts.filter(receipt => 
          receipt.vendor?.toLowerCase().includes(searchLower) ||
          receipt.items?.some(item => item.name?.toLowerCase().includes(searchLower))
        );
      }

      return {
        receipts: filteredReceipts,
        total: filteredReceipts.length,
        hasMore: snapshot.size === limit
      };
    } catch (error) {
      console.error('Firestore get receipts error:', error);
      throw new Error('Failed to fetch receipts from database');
    }
  }

  /**
   * Get single receipt by ID
   */
  async getReceipt(receiptId, userId) {
    try {
      const doc = await this.db.collection(this.collections.receipts).doc(receiptId).get();
      
      if (!doc.exists) {
        throw new Error('Receipt not found');
      }

      const receipt = doc.data();
      
      // Verify ownership
      if (receipt.userId !== userId) {
        throw new Error('Access denied');
      }

      return {
        id: doc.id,
        ...receipt,
        createdAt: receipt.createdAt?.toDate?.() || receipt.createdAt,
        updatedAt: receipt.updatedAt?.toDate?.() || receipt.updatedAt
      };
    } catch (error) {
      console.error('Firestore get receipt error:', error);
      throw error;
    }
  }

  /**
   * Update receipt data
   */
  async updateReceipt(receiptId, updateData, userId) {
    try {
      const receiptRef = this.db.collection(this.collections.receipts).doc(receiptId);
      const doc = await receiptRef.get();

      if (!doc.exists) {
        throw new Error('Receipt not found');
      }

      const receipt = doc.data();
      if (receipt.userId !== userId) {
        throw new Error('Access denied');
      }

      const updates = {
        ...updateData,
        updatedAt: new Date()
      };

      await receiptRef.update(updates);

      return {
        id: receiptId,
        ...receipt,
        ...updates
      };
    } catch (error) {
      console.error('Firestore update receipt error:', error);
      throw error;
    }
  }

  /**
   * Delete receipt
   */
  async deleteReceipt(receiptId, userId) {
    try {
      const receiptRef = this.db.collection(this.collections.receipts).doc(receiptId);
      const doc = await receiptRef.get();

      if (!doc.exists) {
        throw new Error('Receipt not found');
      }

      const receipt = doc.data();
      if (receipt.userId !== userId) {
        throw new Error('Access denied');
      }

      await receiptRef.delete();

      // Update user statistics
      await this.updateUserStats(userId, -receipt.total, receipt.category);

      return { success: true };
    } catch (error) {
      console.error('Firestore delete receipt error:', error);
      throw error;
    }
  }

  /**
   * Get analytics data for a user
   */
  async getAnalytics(userId, options = {}) {
    try {
      const {
        period = 'month',
        startDate,
        endDate
      } = options;

      // Calculate date range
      const now = new Date();
      let start, end;

      if (startDate && endDate) {
        start = new Date(startDate);
        end = new Date(endDate);
      } else {
        switch (period) {
          case 'week':
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
            break;
          case 'month':
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          case 'year':
            start = new Date(now.getFullYear(), 0, 1);
            break;
          default:
            start = new Date(now.getFullYear(), now.getMonth(), 1);
        }
        end = now;
      }

      // Get receipts in date range
      const receiptsQuery = await this.db.collection(this.collections.receipts)
        .where('userId', '==', userId)
        .where('date', '>=', start.toISOString().split('T')[0])
        .where('date', '<=', end.toISOString().split('T')[0])
        .get();

      const receipts = [];
      receiptsQuery.forEach(doc => {
        receipts.push(doc.data());
      });

      // Calculate analytics
      const totalSpent = receipts.reduce((sum, receipt) => sum + (receipt.total || 0), 0);
      const averageDaily = totalSpent / Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));

      // Group by categories
      const categoryTotals = {};
      receipts.forEach(receipt => {
        const category = receipt.category || 'Otros';
        categoryTotals[category] = (categoryTotals[category] || 0) + receipt.total;
      });

      const topCategories = Object.entries(categoryTotals)
        .map(([name, amount]) => ({
          name,
          amount,
          percentage: Math.round((amount / totalSpent) * 100) || 0
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      // Get previous period for trend
      const prevStart = new Date(start.getTime() - (end.getTime() - start.getTime()));
      const prevQuery = await this.db.collection(this.collections.receipts)
        .where('userId', '==', userId)
        .where('date', '>=', prevStart.toISOString().split('T')[0])
        .where('date', '<', start.toISOString().split('T')[0])
        .get();

      let previousTotal = 0;
      prevQuery.forEach(doc => {
        previousTotal += doc.data().total || 0;
      });

      const trend = {
        current: totalSpent,
        previous: previousTotal,
        change: previousTotal ? ((totalSpent - previousTotal) / previousTotal * 100) : 0
      };

      return {
        period,
        totalSpent,
        averageDaily,
        topCategories,
        trend,
        totalReceipts: receipts.length,
        dateRange: {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0]
        }
      };
    } catch (error) {
      console.error('Firestore analytics error:', error);
      throw new Error('Failed to fetch analytics data');
    }
  }

  /**
   * Get or create user profile
   */
  async getUserProfile(userId) {
    try {
      const userRef = this.db.collection(this.collections.users).doc(userId);
      const doc = await userRef.get();

      if (!doc.exists) {
        // Create new user profile
        const newUser = {
          id: userId,
          createdAt: new Date(),
          totalReceipts: 0,
          totalSpent: 0,
          preferences: {
            defaultCategory: 'Otros',
            currency: 'EUR',
            language: 'es'
          }
        };

        await userRef.set(newUser);
        return newUser;
      }

      return {
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
      };
    } catch (error) {
      console.error('Firestore user profile error:', error);
      throw new Error('Failed to fetch user profile');
    }
  }

  /**
   * Update user statistics
   */
  async updateUserStats(userId, amountChange, category) {
    try {
      const userRef = this.db.collection(this.collections.users).doc(userId);
      
      await this.db.runTransaction(async (t) => {
        const doc = await t.get(userRef);
        
        if (doc.exists) {
          const currentData = doc.data();
          t.update(userRef, {
            totalSpent: (currentData.totalSpent || 0) + amountChange,
            totalReceipts: Math.max(0, (currentData.totalReceipts || 0) + (amountChange > 0 ? 1 : -1)),
            updatedAt: new Date()
          });
        }
      });
    } catch (error) {
      console.error('User stats update error:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Get default categories
   */
  async getCategories() {
    try {
      const categoriesRef = this.db.collection(this.collections.categories);
      const snapshot = await categoriesRef.get();

      if (snapshot.empty) {
        // Initialize default categories
        const defaultCategories = [
          { id: '1', name: 'Alimentación', icon: '🛒', color: '#10B981' },
          { id: '2', name: 'Transporte', icon: '🚗', color: '#3B82F6' },
          { id: '3', name: 'Restaurantes', icon: '🍽️', color: '#F59E0B' },
          { id: '4', name: 'Salud', icon: '🏥', color: '#EF4444' },
          { id: '5', name: 'Entretenimiento', icon: '🎬', color: '#8B5CF6' },
          { id: '6', name: 'Hogar', icon: '🏠', color: '#EC4899' },
          { id: '7', name: 'Ropa', icon: '👕', color: '#06B6D4' },
          { id: '8', name: 'Servicios', icon: '💡', color: '#84CC16' },
          { id: '9', name: 'Otros', icon: '📦', color: '#6B7280' }
        ];

        // Add categories to Firestore
        const batch = this.db.batch();
        defaultCategories.forEach(category => {
          const docRef = categoriesRef.doc(category.id);
          batch.set(docRef, category);
        });
        await batch.commit();

        return defaultCategories;
      }

      const categories = [];
      snapshot.forEach(doc => {
        categories.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return categories;
    } catch (error) {
      console.error('Firestore categories error:', error);
      throw new Error('Failed to fetch categories');
    }
  }

  /**
   * Initialize Firestore indexes and rules
   */
  async initializeDatabase() {
    try {
      // This method would typically be called during deployment
      // to ensure required indexes are created
      console.log('Firestore database initialized');
    } catch (error) {
      console.error('Database initialization error:', error);
    }
  }
}

module.exports = FirestoreService;