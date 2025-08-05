#!/usr/bin/env node

/**
 * Smaže test pending uživatele
 * Usage: node delete-test-user.js [userId]
 */

const admin = require('firebase-admin');

const userId = process.argv[2];

if (!userId) {
  console.log('❌ Usage: node delete-test-user.js <userId>');
  process.exit(1);
}

async function deleteTestUser() {
  try {
    // Initialize Firebase
    if (admin.apps.length === 0) {
      admin.initializeApp({
        projectId: 'brana-a71fe'
      });
    }
    
    const db = admin.firestore();
    
    // Check if user exists
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      console.log(`❌ User ${userId} not found`);
      return;
    }
    
    const userData = userDoc.data();
    console.log(`🗑️  Deleting user: ${userData.email} (${userData.displayName})`);
    
    // Delete user
    await db.collection('users').doc(userId).delete();
    
    console.log('✅ Test user deleted successfully!');
    
    // Verify deletion
    const pendingQuery = await db.collection('users')
      .where('status', '==', 'pending')
      .get();
    
    console.log(`📊 Remaining pending users: ${pendingQuery.size}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

deleteTestUser();