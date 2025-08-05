#!/usr/bin/env node

/**
 * Firebase Test Script
 * Samostatný Node.js script pro přímé testování Firebase připojení
 * a diagnostiku problémů s pending users
 */

const admin = require('firebase-admin');
const path = require('path');

// Barvy pro console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(colors.blue + '🔍 INFO: ' + colors.reset + msg),
  success: (msg) => console.log(colors.green + '✅ SUCCESS: ' + colors.reset + msg),
  error: (msg) => console.log(colors.red + '❌ ERROR: ' + colors.reset + msg),
  warning: (msg) => console.log(colors.yellow + '⚠️  WARNING: ' + colors.reset + msg),
  debug: (msg) => console.log(colors.cyan + '🔧 DEBUG: ' + colors.reset + msg),
  header: (msg) => console.log(colors.bright + colors.magenta + '🚀 ' + msg + colors.reset)
};

class FirebaseTestRunner {
  constructor() {
    this.app = null;
    this.db = null;
    this.testResults = {
      connection: false,
      adminAuth: false,
      readUsers: false,
      readPendingUsers: false,
      writeOperations: false,
      permissions: false
    };
  }

  /**
   * Inicializace Firebase Admin SDK
   */
  async initializeFirebase() {
    try {
      log.header('INITIALIZING FIREBASE ADMIN SDK');
      
      // Zkontroluj jestli už není inicializován
      if (admin.apps.length > 0) {
        log.info('Firebase already initialized, using existing app');
        this.app = admin.app();
        this.db = admin.firestore();
        this.testResults.connection = true;
        return;
      }
      
      // Pokus o načtení service account key
      const serviceAccountPath = path.join(__dirname, '../lismag-firebase-adminsdk-fbsvc-aa34112581.json');
      
      try {
        const serviceAccount = require(serviceAccountPath);
        log.info('Service account key loaded from: ' + serviceAccountPath);
        
        this.app = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: 'brana-a71fe'
        });
        
      } catch (keyError) {
        log.warning('Service account key not found, trying application default credentials');
        
        this.app = admin.initializeApp({
          projectId: 'brana-a71fe'
        });
      }
      
      this.db = admin.firestore();
      log.success('Firebase Admin SDK initialized');
      this.testResults.connection = true;
      
      return true;
      
    } catch (error) {
      log.error('Firebase initialization failed: ' + error.message);
      return false;
    }
  }

  /**
   * Test základního připojení k Firestore
   */
  async testConnection() {
    try {
      log.header('TESTING FIRESTORE CONNECTION');
      
      // Pokus o jednoduchý dotaz
      const testQuery = await this.db.collection('users').limit(1).get();
      log.success(`Connection test passed - can access users collection (${testQuery.size} docs)`);
      
      return true;
      
    } catch (error) {
      log.error('Connection test failed: ' + error.message);
      log.debug('Error code: ' + (error.code || 'unknown'));
      return false;
    }
  }

  /**
   * Test čtení všech uživatelů
   */
  async testReadAllUsers() {
    try {
      log.header('TESTING READ ALL USERS');
      
      const usersSnapshot = await this.db.collection('users').get();
      log.success(`Successfully read ${usersSnapshot.size} users from Firestore`);
      
      // Analýza typů uživatelů
      const userStats = {
        total: 0,
        admins: 0,
        users: 0,
        pending: 0,
        approved: 0,
        rejected: 0
      };
      
      usersSnapshot.forEach(doc => {
        const data = doc.data();
        userStats.total++;
        
        if (data.role === 'admin') userStats.admins++;
        if (data.role === 'user') userStats.users++;
        if (data.status === 'pending') userStats.pending++;
        if (data.status === 'approved') userStats.approved++;
        if (data.status === 'rejected') userStats.rejected++;
        
        log.debug(`User ${doc.id}: ${data.email} | Role: ${data.role} | Status: ${data.status}`);
      });
      
      log.info('User Statistics:');
      console.table(userStats);
      
      this.testResults.readUsers = true;
      return userStats;
      
    } catch (error) {
      log.error('Read all users failed: ' + error.message);
      return null;
    }
  }

  /**
   * Test čtení pending users s různými metodami
   */
  async testReadPendingUsers() {
    try {
      log.header('TESTING READ PENDING USERS');
      
      const methods = [
        {
          name: 'Standard Query with where',
          query: () => this.db.collection('users').where('status', '==', 'pending').get()
        },
        {
          name: 'Query with orderBy',
          query: () => this.db.collection('users').where('status', '==', 'pending').orderBy('createdAt', 'desc').get()
        },
        {
          name: 'Get all and filter',
          query: async () => {
            const allUsers = await this.db.collection('users').get();
            const pendingDocs = [];
            allUsers.forEach(doc => {
              if (doc.data().status === 'pending') {
                pendingDocs.push(doc);
              }
            });
            return { docs: pendingDocs, size: pendingDocs.length };
          }
        }
      ];
      
      const results = [];
      
      for (const method of methods) {
        try {
          log.info(`Testing method: ${method.name}`);
          const result = await method.query();
          const pendingCount = result.size || result.docs?.length || 0;
          
          log.success(`${method.name}: Found ${pendingCount} pending users`);
          
          // Detail pending users
          const docs = result.docs || [];
          docs.forEach(doc => {
            const data = doc.data();
            log.debug(`  - ${data.email} (${doc.id}) requested: ${data.requestedAt?.toDate?.() || 'unknown'}`);
          });
          
          results.push({
            method: method.name,
            success: true,
            count: pendingCount,
            users: docs.map(doc => ({ id: doc.id, ...doc.data() }))
          });
          
        } catch (error) {
          log.error(`${method.name} failed: ${error.message}`);
          results.push({
            method: method.name,
            success: false,
            error: error.message,
            code: error.code
          });
        }
      }
      
      log.info('Pending Users Test Results:');
      console.table(results.map(r => ({
        Method: r.method,
        Success: r.success,
        Count: r.count || 'N/A',
        Error: r.error || 'None'
      })));
      
      this.testResults.readPendingUsers = results.some(r => r.success);
      return results;
      
    } catch (error) {
      log.error('Read pending users test failed: ' + error.message);
      return [];
    }
  }

  /**
   * Test write operací (vytvoření, update, smazání)
   */
  async testWriteOperations() {
    try {
      log.header('TESTING WRITE OPERATIONS');
      
      const testUserId = `test-user-${Date.now()}`;
      const testUserData = {
        email: `test-${Date.now()}@example.com`,
        displayName: 'Test User for Firebase Test',
        role: 'user',
        status: 'pending',
        authProvider: 'email',
        permissions: {
          gate: false,
          garage: false,
          camera: false,
          stopMode: false,
          viewLogs: false,
          manageUsers: false,
          requireLocation: false,
          allowGPS: false,
          requireLocationProximity: false
        },
        createdAt: admin.firestore.Timestamp.now(),
        requestedAt: admin.firestore.Timestamp.now()
      };
      
      const operations = [];
      
      try {
        // Test 1: Create
        log.info('Testing CREATE operation...');
        const docRef = await this.db.collection('users').add(testUserData);
        log.success(`CREATE: User document created with ID: ${docRef.id}`);
        operations.push({ op: 'CREATE', success: true, docId: docRef.id });
        
        // Test 2: Read (verify creation)
        log.info('Testing READ operation...');
        const createdDoc = await docRef.get();
        if (createdDoc.exists) {
          log.success('READ: Successfully read created document');
          operations.push({ op: 'READ', success: true });
        } else {
          throw new Error('Created document not found');
        }
        
        // Test 3: Update
        log.info('Testing UPDATE operation...');
        await docRef.update({
          displayName: 'Updated Test User',
          lastUpdate: admin.firestore.Timestamp.now()
        });
        log.success('UPDATE: Document updated successfully');
        operations.push({ op: 'UPDATE', success: true });
        
        // Test 4: Delete
        log.info('Testing DELETE operation...');
        await docRef.delete();
        log.success('DELETE: Document deleted successfully');
        operations.push({ op: 'DELETE', success: true });
        
        // Verify deletion
        const deletedDoc = await docRef.get();
        if (!deletedDoc.exists) {
          log.success('DELETE VERIFIED: Document successfully removed');
        } else {
          log.warning('DELETE ISSUE: Document still exists after deletion');
        }
        
      } catch (error) {
        log.error(`Write operation failed: ${error.message}`);
        operations.push({ op: 'FAILED', success: false, error: error.message });
        
        // Cleanup attempt
        try {
          const cleanupRef = this.db.collection('users').doc(testUserId);
          await cleanupRef.delete();
          log.info('Cleanup: Test document removed');
        } catch (cleanupError) {
          log.warning('Cleanup failed: ' + cleanupError.message);
        }
      }
      
      log.info('Write Operations Results:');
      console.table(operations);
      
      this.testResults.writeOperations = operations.every(op => op.success);
      return operations;
      
    } catch (error) {
      log.error('Write operations test failed: ' + error.message);
      return [];
    }
  }

  /**
   * Test Firebase Security Rules
   */
  async testSecurityRules() {
    try {
      log.header('TESTING FIREBASE SECURITY RULES');
      
      log.info('Testing Admin SDK access (should bypass security rules)...');
      
      // Admin SDK should bypass all security rules
      const testAccess = await this.db.collection('users').limit(1).get();
      log.success('Admin SDK can access Firestore (bypasses security rules)');
      
      log.warning('Note: Admin SDK bypasses all security rules');
      log.info('To test actual security rules, you need to use client SDK with authentication');
      
      return true;
      
    } catch (error) {
      log.error('Security rules test failed: ' + error.message);
      return false;
    }
  }

  /**
   * Test admin operations
   */
  async testAdminOperations() {
    try {
      log.header('TESTING ADMIN OPERATIONS');
      
      // Test admin user lookup
      log.info('Looking for admin users...');
      const adminQuery = await this.db.collection('users')
        .where('role', '==', 'admin')
        .where('status', '==', 'approved')
        .get();
      
      log.success(`Found ${adminQuery.size} admin users`);
      
      adminQuery.forEach(doc => {
        const data = doc.data();
        log.debug(`Admin: ${data.email} | Permissions: ${JSON.stringify(data.permissions)}`);
      });
      
      // Test admin permissions
      if (adminQuery.size > 0) {
        const adminDoc = adminQuery.docs[0];
        const adminData = adminDoc.data();
        
        const hasManageUsers = adminData.permissions?.manageUsers === true;
        if (hasManageUsers) {
          log.success('Admin has manageUsers permission');
        } else {
          log.error('Admin missing manageUsers permission');
        }
      }
      
      this.testResults.adminAuth = adminQuery.size > 0;
      return adminQuery.size > 0;
      
    } catch (error) {
      log.error('Admin operations test failed: ' + error.message);
      return false;
    }
  }

  /**
   * Vytvoří mock pending users pro testování
   */
  async createMockPendingUsers(count = 3) {
    try {
      log.header(`CREATING ${count} MOCK PENDING USERS`);
      
      const mockUsers = [];
      
      for (let i = 1; i <= count; i++) {
        const mockUser = {
          email: `pending-user-${i}-${Date.now()}@example.com`,
          displayName: `Pending User ${i}`,
          role: 'user',
          status: 'pending',
          authProvider: i % 2 === 0 ? 'google' : 'email',
          permissions: {
            gate: false,
            garage: false,
            camera: false,
            stopMode: false,
            viewLogs: false,
            manageUsers: false,
            requireLocation: false,
            allowGPS: false,
            requireLocationProximity: false
          },
          createdAt: admin.firestore.Timestamp.now(),
          requestedAt: admin.firestore.Timestamp.now()
        };
        
        const docRef = await this.db.collection('users').add(mockUser);
        mockUsers.push({ id: docRef.id, ...mockUser });
        log.success(`Created mock user: ${mockUser.email} (${docRef.id})`);
      }
      
      log.success(`Successfully created ${mockUsers.length} mock pending users`);
      return mockUsers;
      
    } catch (error) {
      log.error('Failed to create mock users: ' + error.message);
      return [];
    }
  }

  /**
   * Vyčistí mock users
   */
  async cleanupMockUsers() {
    try {
      log.header('CLEANUP MOCK USERS');
      
      const mockUsersQuery = await this.db.collection('users')
        .where('email', '>=', 'pending-user-')
        .where('email', '<', 'pending-user-z')
        .get();
      
      const batch = this.db.batch();
      let deleteCount = 0;
      
      mockUsersQuery.forEach(doc => {
        const data = doc.data();
        if (data.email.includes('pending-user-') || data.email.includes('test-')) {
          batch.delete(doc.ref);
          deleteCount++;
          log.debug(`Queued for deletion: ${data.email} (${doc.id})`);
        }
      });
      
      if (deleteCount > 0) {
        await batch.commit();
        log.success(`Cleaned up ${deleteCount} mock users`);
      } else {
        log.info('No mock users found to cleanup');
      }
      
      return deleteCount;
      
    } catch (error) {
      log.error('Cleanup failed: ' + error.message);
      return 0;
    }
  }

  /**
   * Spustí kompletní test suite
   */
  async runCompleteTest() {
    try {
      log.header('🚀 STARTING COMPLETE FIREBASE TEST SUITE');
      console.log('='.repeat(60));
      
      const startTime = Date.now();
      
      // 1. Initialize
      if (!await this.initializeFirebase()) {
        log.error('Firebase initialization failed - aborting tests');
        return false;
      }
      
      // 2. Basic connection
      await this.testConnection();
      
      // 3. Read operations
      await this.testReadAllUsers();
      await this.testReadPendingUsers();
      
      // 4. Admin operations
      await this.testAdminOperations();
      
      // 5. Write operations
      await this.testWriteOperations();
      
      // 6. Security rules
      await this.testSecurityRules();
      
      // 7. Create mock data for testing
      log.info('Do you want to create mock pending users? (Skip for production)');
      // const mockUsers = await this.createMockPendingUsers(2);
      
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      
      // Final report
      log.header('📊 FINAL TEST RESULTS');
      console.log('='.repeat(60));
      
      const results = this.testResults;
      const passedTests = Object.values(results).filter(Boolean).length;
      const totalTests = Object.keys(results).length;
      
      console.table(results);
      
      if (passedTests === totalTests) {
        log.success(`ALL TESTS PASSED! (${passedTests}/${totalTests}) - Duration: ${duration}s`);
      } else {
        log.warning(`SOME TESTS FAILED (${passedTests}/${totalTests}) - Duration: ${duration}s`);
      }
      
      // Recommendations
      log.header('🔧 RECOMMENDATIONS');
      if (!results.readPendingUsers) {
        log.info('- Check Firebase Security Rules for users collection');
        log.info('- Verify Firestore indexes are properly configured');
        log.info('- Ensure admin user has proper permissions');
      }
      
      if (!results.writeOperations) {
        log.info('- Check write permissions in Firebase Security Rules');
        log.info('- Verify authentication is working correctly');
      }
      
      return passedTests === totalTests;
      
    } catch (error) {
      log.error('Complete test failed: ' + error.message);
      return false;
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const testRunner = new FirebaseTestRunner();
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Firebase Test Script Usage:
  
Commands:
  node firebase-test-script.js              # Run complete test suite
  node firebase-test-script.js --connection # Test only connection
  node firebase-test-script.js --users      # Test only user operations
  node firebase-test-script.js --mock       # Create mock pending users
  node firebase-test-script.js --cleanup    # Cleanup mock users
  node firebase-test-script.js --help       # Show this help
  
Environment:
  Requires Firebase Admin SDK credentials
  Either via service account key or application default credentials
    `);
    return;
  }
  
  try {
    // Initialize Firebase first
    if (!await testRunner.initializeFirebase()) {
      log.error('Cannot proceed without Firebase connection');
      process.exit(1);
    }
    
    if (args.includes('--connection')) {
      await testRunner.testConnection();
    } else if (args.includes('--users')) {
      await testRunner.testReadAllUsers();
      await testRunner.testReadPendingUsers();
    } else if (args.includes('--mock')) {
      await testRunner.createMockPendingUsers(3);
    } else if (args.includes('--cleanup')) {
      await testRunner.cleanupMockUsers();
    } else {
      // Run complete test
      const success = await testRunner.runCompleteTest();
      process.exit(success ? 0 : 1);
    }
    
  } catch (error) {
    log.error('Script execution failed: ' + error.message);
    console.error(error);
    process.exit(1);
  }
}

// Handle script termination
process.on('SIGINT', async () => {
  log.warning('Script interrupted - cleaning up...');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  log.error('Uncaught exception: ' + error.message);
  console.error(error);
  process.exit(1);
});

// Run main function
main();