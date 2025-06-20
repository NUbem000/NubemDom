const admin = require('firebase-admin');

class AuthMiddleware {
  constructor() {
    this.initializeFirebase();
  }

  initializeFirebase() {
    try {
      // Initialize Firebase Admin SDK
      if (!admin.apps.length) {
        admin.initializeApp({
          projectId: process.env.PROJECT_ID || 'nubemdom',
          // In production, use service account key or default credentials
        });
      }
      
      this.auth = admin.auth();
      console.log('Firebase Admin initialized');
    } catch (error) {
      console.error('Firebase initialization error:', error);
    }
  }

  /**
   * Middleware to verify Firebase ID token
   */
  async verifyToken(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
          error: 'Authorization token required',
          code: 'TOKEN_MISSING'
        });
      }

      const idToken = authHeader.split(' ')[1];
      
      if (!idToken) {
        return res.status(401).json({ 
          error: 'Invalid authorization format',
          code: 'TOKEN_INVALID_FORMAT'
        });
      }

      // Verify the ID token
      const decodedToken = await this.auth.verifyIdToken(idToken);
      
      // Add user info to request
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name,
        picture: decodedToken.picture,
        emailVerified: decodedToken.email_verified
      };

      next();
    } catch (error) {
      console.error('Token verification error:', error);
      
      let errorCode = 'TOKEN_INVALID';
      let message = 'Invalid or expired token';

      if (error.code === 'auth/id-token-expired') {
        errorCode = 'TOKEN_EXPIRED';
        message = 'Token has expired';
      } else if (error.code === 'auth/id-token-revoked') {
        errorCode = 'TOKEN_REVOKED';
        message = 'Token has been revoked';
      } else if (error.code === 'auth/invalid-id-token') {
        errorCode = 'TOKEN_MALFORMED';
        message = 'Malformed token';
      }

      return res.status(401).json({ 
        error: message,
        code: errorCode
      });
    }
  }

  /**
   * Optional middleware - allows both authenticated and anonymous access
   */
  async optionalAuth(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const idToken = authHeader.split(' ')[1];
        
        if (idToken) {
          try {
            const decodedToken = await this.auth.verifyIdToken(idToken);
            req.user = {
              uid: decodedToken.uid,
              email: decodedToken.email,
              name: decodedToken.name,
              picture: decodedToken.picture,
              emailVerified: decodedToken.email_verified
            };
          } catch (error) {
            // Token invalid, but continue as anonymous
            console.warn('Optional auth token invalid:', error.message);
          }
        }
      }

      next();
    } catch (error) {
      // Log error but continue
      console.error('Optional auth error:', error);
      next();
    }
  }

  /**
   * Create custom token for testing
   */
  async createCustomToken(uid, additionalClaims = {}) {
    try {
      const customToken = await this.auth.createCustomToken(uid, additionalClaims);
      return customToken;
    } catch (error) {
      console.error('Custom token creation error:', error);
      throw error;
    }
  }

  /**
   * Get user by UID
   */
  async getUser(uid) {
    try {
      const userRecord = await this.auth.getUser(uid);
      return {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        photoURL: userRecord.photoURL,
        emailVerified: userRecord.emailVerified,
        disabled: userRecord.disabled,
        metadata: {
          creationTime: userRecord.metadata.creationTime,
          lastSignInTime: userRecord.metadata.lastSignInTime
        }
      };
    } catch (error) {
      console.error('Get user error:', error);
      throw error;
    }
  }

  /**
   * Update user claims
   */
  async setCustomClaims(uid, customClaims) {
    try {
      await this.auth.setCustomUserClaims(uid, customClaims);
      return true;
    } catch (error) {
      console.error('Set custom claims error:', error);
      throw error;
    }
  }

  /**
   * Revoke user tokens
   */
  async revokeTokens(uid) {
    try {
      await this.auth.revokeRefreshTokens(uid);
      return true;
    } catch (error) {
      console.error('Revoke tokens error:', error);
      throw error;
    }
  }

  /**
   * Delete user
   */
  async deleteUser(uid) {
    try {
      await this.auth.deleteUser(uid);
      return true;
    } catch (error) {
      console.error('Delete user error:', error);
      throw error;
    }
  }

  /**
   * Admin middleware - requires admin role
   */
  async requireAdmin(req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({ 
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // Check if user has admin claims
      const userRecord = await this.auth.getUser(req.user.uid);
      const customClaims = userRecord.customClaims || {};

      if (!customClaims.admin) {
        return res.status(403).json({ 
          error: 'Admin access required',
          code: 'ADMIN_REQUIRED'
        });
      }

      req.user.isAdmin = true;
      next();
    } catch (error) {
      console.error('Admin check error:', error);
      return res.status(500).json({ 
        error: 'Authorization check failed',
        code: 'AUTH_CHECK_FAILED'
      });
    }
  }

  /**
   * Rate limiting by user
   */
  createUserRateLimit(maxRequests = 100, windowMs = 15 * 60 * 1000) {
    const userRequests = new Map();

    return (req, res, next) => {
      const userId = req.user?.uid || req.ip;
      const now = Date.now();
      const windowStart = now - windowMs;

      // Clean old requests
      if (userRequests.has(userId)) {
        const requests = userRequests.get(userId).filter(time => time > windowStart);
        userRequests.set(userId, requests);
      } else {
        userRequests.set(userId, []);
      }

      const currentRequests = userRequests.get(userId);

      if (currentRequests.length >= maxRequests) {
        return res.status(429).json({
          error: 'Too many requests',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }

      currentRequests.push(now);
      next();
    };
  }

  /**
   * Middleware to validate email verification
   */
  requireEmailVerification(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!req.user.emailVerified) {
      return res.status(403).json({ 
        error: 'Email verification required',
        code: 'EMAIL_NOT_VERIFIED'
      });
    }

    next();
  }
}

// Create singleton instance
const authMiddleware = new AuthMiddleware();

module.exports = {
  verifyToken: authMiddleware.verifyToken.bind(authMiddleware),
  optionalAuth: authMiddleware.optionalAuth.bind(authMiddleware),
  requireAdmin: authMiddleware.requireAdmin.bind(authMiddleware),
  requireEmailVerification: authMiddleware.requireEmailVerification.bind(authMiddleware),
  createUserRateLimit: authMiddleware.createUserRateLimit.bind(authMiddleware),
  createCustomToken: authMiddleware.createCustomToken.bind(authMiddleware),
  getUser: authMiddleware.getUser.bind(authMiddleware),
  setCustomClaims: authMiddleware.setCustomClaims.bind(authMiddleware),
  revokeTokens: authMiddleware.revokeTokens.bind(authMiddleware),
  deleteUser: authMiddleware.deleteUser.bind(authMiddleware)
};