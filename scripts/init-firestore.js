#!/usr/bin/env node

const FirestoreService = require('../services/firestore');

async function initializeFirestore() {
  console.log('🔥 Initializing Firestore database...');
  
  try {
    const firestoreService = new FirestoreService();
    
    // Initialize categories
    console.log('📁 Setting up categories...');
    const categories = await firestoreService.getCategories();
    console.log(`✅ Categories initialized: ${categories.length} categories`);
    
    // Create a test user profile to verify everything works
    console.log('👤 Creating test user profile...');
    const testProfile = await firestoreService.getUserProfile('test-init-user');
    console.log('✅ Test user profile created:', testProfile.id);
    
    console.log('🎉 Firestore initialization completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Firestore initialization failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

initializeFirestore();