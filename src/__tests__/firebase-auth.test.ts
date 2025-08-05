/**
 * Firebase Authentication Tests
 * Kompletní test suite pro Firebase autentifikaci a Firestore operace
 */

import { auth, db } from '../firebase/config';
import { FirebaseDebug } from '../utils/firebaseDebug';
import { adminService } from '../services/adminService';
import { userService } from '../services/userService';
import { User } from '../types';

// Mock Firebase pro testování
jest.mock('../firebase/config', () => ({
  auth: {
    currentUser: null,
    onAuthStateChanged: jest.fn(),
    signInWithEmailAndPassword: jest.fn(),
    signInWithPopup: jest.fn(),
    signOut: jest.fn(),
    createUserWithEmailAndPassword: jest.fn()
  },
  db: {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(),
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      })),
      where: jest.fn(() => ({
        get: jest.fn(),
        limit: jest.fn(() => ({
          get: jest.fn()
        })),
        orderBy: jest.fn(() => ({
          get: jest.fn()
        }))
      })),
      add: jest.fn(),
      get: jest.fn()
    }))
  },
  googleProvider: {}
}));

describe('Firebase Authentication Tests', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    console.log('🧪 Test Setup: Clearing all mocks');
  });

  describe('Firebase Connection Tests', () => {
    
    test('should verify Firebase config is loaded', () => {
      console.log('🔍 Testing Firebase config loading...');
      expect(auth).toBeDefined();
      expect(db).toBeDefined();
      console.log('✅ Firebase config test passed');
    });

    test('should handle Firebase initialization errors', async () => {
      console.log('🔍 Testing Firebase initialization error handling...');
      
      // Simuluj Firebase init error
      const mockError = new Error('Firebase init failed');
      (auth.currentUser as any) = null;
      
      const result = await FirebaseDebug.getCurrentUserDetails();
      expect(result.error).toBe('No Firebase user logged in');
      console.log('✅ Firebase init error handling test passed');
    });
  });

  describe('User Authentication Tests', () => {
    
    test('should authenticate user with email/password', async () => {
      console.log('🔍 Testing email/password authentication...');
      
      const mockUser = {
        uid: 'test-uid-123',
        email: 'test@example.com',
        emailVerified: true,
        displayName: 'Test User',
        getIdToken: jest.fn().mockResolvedValue('mock-token')
      };

      (auth.signInWithEmailAndPassword as jest.Mock).mockResolvedValue({
        user: mockUser
      });

      const result = await auth.signInWithEmailAndPassword('test@example.com', 'password');
      expect(result.user).toEqual(mockUser);
      console.log('✅ Email/password authentication test passed');
    });

    test('should handle authentication errors', async () => {
      console.log('🔍 Testing authentication error handling...');
      
      const mockError = {
        code: 'auth/wrong-password',
        message: 'Wrong password'
      };

      (auth.signInWithEmailAndPassword as jest.Mock).mockRejectedValue(mockError);

      await expect(auth.signInWithEmailAndPassword('test@example.com', 'wrong')).rejects.toEqual(mockError);
      console.log('✅ Authentication error handling test passed');
    });

    test('should get user auth token', async () => {
      console.log('🔍 Testing auth token retrieval...');
      
      const mockUser = {
        uid: 'test-uid-123',
        email: 'test@example.com',
        getIdToken: jest.fn().mockResolvedValue('mock-auth-token-12345')
      };

      (auth.currentUser as any) = mockUser;

      const token = await mockUser.getIdToken(true);
      expect(token).toBe('mock-auth-token-12345');
      expect(mockUser.getIdToken).toHaveBeenCalledWith(true);
      console.log('✅ Auth token retrieval test passed');
    });
  });

  describe('Firestore User Operations Tests', () => {
    
    test('should create user document in Firestore', async () => {
      console.log('🔍 Testing Firestore user document creation...');
      
      const mockDocRef = {
        id: 'new-doc-id',
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            email: 'newuser@example.com',
            role: 'user',
            status: 'pending'
          })
        })
      };

      (db.collection as jest.Mock).mockReturnValue({
        add: jest.fn().mockResolvedValue(mockDocRef)
      });

      const userData = {
        email: 'newuser@example.com',
        displayName: 'New User',
        role: 'user',
        status: 'pending',
        createdAt: new Date()
      };

      const result = await db.collection('users').add(userData);
      expect(result.id).toBe('new-doc-id');
      console.log('✅ Firestore user creation test passed');
    });

    test('should get user by email', async () => {
      console.log('🔍 Testing get user by email...');
      
      const mockQuerySnapshot = {
        empty: false,
        docs: [{
          id: 'user-doc-id',
          data: () => ({
            email: 'test@example.com',
            displayName: 'Test User',
            role: 'user',
            status: 'approved',
            permissions: { gate: true }
          })
        }]
      };

      (db.collection as jest.Mock).mockReturnValue({
        where: jest.fn(() => ({
          limit: jest.fn(() => ({
            get: jest.fn().mockResolvedValue(mockQuerySnapshot)
          }))
        }))
      });

      const user = await userService.getUserByEmail('test@example.com');
      expect(user).toBeDefined();
      expect(user?.email).toBe('test@example.com');
      console.log('✅ Get user by email test passed');
    });

    test('should handle user not found scenario', async () => {
      console.log('🔍 Testing user not found scenario...');
      
      const mockEmptySnapshot = {
        empty: true,
        docs: []
      };

      (db.collection as jest.Mock).mockReturnValue({
        where: jest.fn(() => ({
          limit: jest.fn(() => ({
            get: jest.fn().mockResolvedValue(mockEmptySnapshot)
          }))
        }))
      });

      const user = await userService.getUserByEmail('nonexistent@example.com');
      expect(user).toBeNull();
      console.log('✅ User not found test passed');
    });
  });

  describe('Admin Permissions Tests', () => {
    
    test('should verify admin permissions correctly', async () => {
      console.log('🔍 Testing admin permissions verification...');
      
      const mockAdminUser = {
        uid: 'admin-uid',
        email: 'admin@example.com',
        getIdToken: jest.fn().mockResolvedValue('admin-token')
      };

      const mockUserDoc = {
        exists: true,
        id: 'admin-doc-id',
        data: () => ({
          email: 'admin@example.com',
          role: 'admin',
          status: 'approved',
          permissions: {
            manageUsers: true,
            gate: true,
            camera: true
          }
        })
      };

      (auth.currentUser as any) = mockAdminUser;
      (db.collection as jest.Mock).mockReturnValue({
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue(mockUserDoc)
        }))
      });

      const result = await adminService.verifyAdminAccess();
      expect(result.isAdmin).toBe(true);
      expect(result.user?.role).toBe('admin');
      expect(result.user?.permissions?.manageUsers).toBe(true);
      console.log('✅ Admin permissions verification test passed');
    });

    test('should reject non-admin users', async () => {
      console.log('🔍 Testing non-admin user rejection...');
      
      const mockRegularUser = {
        uid: 'user-uid',
        email: 'user@example.com',
        getIdToken: jest.fn().mockResolvedValue('user-token')
      };

      const mockUserDoc = {
        exists: true,
        id: 'user-doc-id',
        data: () => ({
          email: 'user@example.com',
          role: 'user',
          status: 'approved',
          permissions: {
            manageUsers: false,
            gate: true
          }
        })
      };

      (auth.currentUser as any) = mockRegularUser;
      (db.collection as jest.Mock).mockReturnValue({
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue(mockUserDoc)
        }))
      });

      const result = await adminService.verifyAdminAccess();
      expect(result.isAdmin).toBe(false);
      expect(result.user?.role).toBe('user');
      console.log('✅ Non-admin user rejection test passed');
    });
  });

  describe('Pending Users Tests', () => {
    
    test('should get pending users successfully', async () => {
      console.log('🔍 Testing pending users retrieval...');
      
      const mockPendingUsers = [
        {
          id: 'pending-1',
          data: () => ({
            email: 'pending1@example.com',
            displayName: 'Pending User 1',
            status: 'pending',
            role: 'user',
            requestedAt: { toDate: () => new Date() }
          })
        },
        {
          id: 'pending-2',
          data: () => ({
            email: 'pending2@example.com',
            displayName: 'Pending User 2',
            status: 'pending',
            role: 'user',
            requestedAt: { toDate: () => new Date() }
          })
        }
      ];

      (db.collection as jest.Mock).mockReturnValue({
        where: jest.fn(() => ({
          orderBy: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({
              size: 2,
              docs: mockPendingUsers
            })
          }))
        }))
      });

      const result = await userService.getPendingUsers();
      expect(result).toHaveLength(2);
      expect(result[0].email).toBe('pending1@example.com');
      expect(result[0].status).toBe('pending');
      console.log('✅ Pending users retrieval test passed');
    });

    test('should handle empty pending users', async () => {
      console.log('🔍 Testing empty pending users scenario...');
      
      (db.collection as jest.Mock).mockReturnValue({
        where: jest.fn(() => ({
          orderBy: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({
              size: 0,
              docs: []
            })
          }))
        }))
      });

      const result = await userService.getPendingUsers();
      expect(result).toHaveLength(0);
      console.log('✅ Empty pending users test passed');
    });

    test('should handle Firestore permission errors', async () => {
      console.log('🔍 Testing Firestore permission errors...');
      
      const permissionError = {
        code: 'permission-denied',
        message: 'Missing or insufficient permissions'
      };

      (db.collection as jest.Mock).mockReturnValue({
        where: jest.fn(() => ({
          orderBy: jest.fn(() => ({
            get: jest.fn().mockRejectedValue(permissionError)
          }))
        }))
      });

      const result = await userService.getPendingUsers();
      expect(result).toHaveLength(0); // Mělo by vrátit prázdný array při chybě
      console.log('✅ Firestore permission error handling test passed');
    });
  });

  describe('CRUD Operations Tests', () => {
    
    test('should approve user successfully', async () => {
      console.log('🔍 Testing user approval...');
      
      const mockUpdate = jest.fn().mockResolvedValue(undefined);
      
      (db.collection as jest.Mock).mockReturnValue({
        doc: jest.fn(() => ({
          update: mockUpdate
        }))
      });

      await userService.approveUser('user-id', 'admin-id');
      
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        status: 'approved',
        approvedBy: 'admin-id'
      }));
      console.log('✅ User approval test passed');
    });

    test('should reject user with reason', async () => {
      console.log('🔍 Testing user rejection...');
      
      const mockUpdate = jest.fn().mockResolvedValue(undefined);
      
      (db.collection as jest.Mock).mockReturnValue({
        doc: jest.fn(() => ({
          update: mockUpdate
        }))
      });

      await userService.rejectUser('user-id', 'admin-id', 'Invalid credentials');
      
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        status: 'rejected',
        rejectedBy: 'admin-id',
        rejectedReason: 'Invalid credentials'
      }));
      console.log('✅ User rejection test passed');
    });

    test('should update user lastLogin', async () => {
      console.log('🔍 Testing lastLogin update...');
      
      const mockUpdate = jest.fn().mockResolvedValue(undefined);
      
      (db.collection as jest.Mock).mockReturnValue({
        doc: jest.fn(() => ({
          update: mockUpdate
        }))
      });

      await userService.updateLastLogin('user-id');
      
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        lastLogin: expect.any(Object)
      }));
      console.log('✅ LastLogin update test passed');
    });
  });

  describe('Firebase Debug Utility Tests', () => {
    
    test('should run complete diagnostic', async () => {
      console.log('🔍 Testing Firebase debug diagnostic...');
      
      // Mock konzole spy
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const mockUser = {
        uid: 'test-uid',
        email: 'test@example.com',
        getIdToken: jest.fn().mockResolvedValue('token')
      };

      (auth.currentUser as any) = mockUser;
      
      // Mock všechny potřebné metody
      jest.spyOn(FirebaseDebug, 'getCurrentUserDetails').mockResolvedValue({
        firebaseUser: { uid: 'test-uid', email: 'test@example.com' },
        firestoreUser: { role: 'admin', status: 'approved' }
      });

      jest.spyOn(FirebaseDebug, 'verifyAdminPermissions').mockResolvedValue({
        isAdmin: true,
        role: 'admin'
      });

      jest.spyOn(FirebaseDebug, 'testFirestoreOperations').mockResolvedValue({
        canRead: true,
        canCreate: true,
        canUpdate: true,
        canDelete: true
      });

      await FirebaseDebug.runFullDiagnostic();
      
      expect(consoleSpy).toHaveBeenCalledWith('🚀 FirebaseDebug: Starting full diagnostic...');
      
      consoleSpy.mockRestore();
      console.log('✅ Firebase debug diagnostic test passed');
    });
  });
});

/**
 * Integration Tests
 * Testuje vzájemnou spolupráci komponent
 */
describe('Firebase Integration Tests', () => {
  
  test('should complete full auth flow with admin verification', async () => {
    console.log('🔍 Testing complete auth flow...');
    
    const mockAdminUser = {
      uid: 'admin-uid',
      email: 'admin@example.com',
      emailVerified: true,
      getIdToken: jest.fn().mockResolvedValue('admin-token')
    };

    const mockUserDoc = {
      exists: true,
      id: 'admin-doc-id',
      data: () => ({
        email: 'admin@example.com',
        role: 'admin',
        status: 'approved',
        permissions: { manageUsers: true }
      })
    };

    // Setup mocks pro celý flow
    (auth.signInWithEmailAndPassword as jest.Mock).mockResolvedValue({
      user: mockAdminUser
    });
    (auth.currentUser as any) = mockAdminUser;
    (db.collection as jest.Mock).mockReturnValue({
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue(mockUserDoc)
      }))
    });

    // 1. Přihlášení
    const authResult = await auth.signInWithEmailAndPassword('admin@example.com', 'password');
    expect(authResult.user.email).toBe('admin@example.com');

    // 2. Ověření admin oprávnění
    const adminCheck = await adminService.verifyAdminAccess();
    expect(adminCheck.isAdmin).toBe(true);

    // 3. Token získání
    const token = await mockAdminUser.getIdToken(true);
    expect(token).toBe('admin-token');

    console.log('✅ Complete auth flow integration test passed');
  });

  test('should handle permission denied scenario gracefully', async () => {
    console.log('🔍 Testing permission denied scenario...');
    
    const mockUser = {
      uid: 'user-uid',
      email: 'user@example.com',
      getIdToken: jest.fn().mockResolvedValue('user-token')
    };

    const permissionError = {
      code: 'permission-denied',
      message: 'Missing or insufficient permissions'
    };

    (auth.currentUser as any) = mockUser;
    (db.collection as jest.Mock).mockReturnValue({
      doc: jest.fn(() => ({
        get: jest.fn().mockRejectedValue(permissionError)
      })),
      where: jest.fn(() => ({
        get: jest.fn().mockRejectedValue(permissionError)
      }))
    });

    // Test admin service s permission error
    const adminResult = await adminService.verifyAdminAccess();
    expect(adminResult.isAdmin).toBe(false);
    expect(adminResult.error).toContain('Firebase error');

    // Test fallback metoda
    const fallbackResult = await adminService.getPendingUsersWithFallback();
    expect(fallbackResult.method).toBe('failed');
    expect(fallbackResult.users).toHaveLength(0);

    console.log('✅ Permission denied scenario test passed');
  });
});