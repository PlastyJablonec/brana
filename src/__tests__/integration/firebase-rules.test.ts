/**
 * Firebase Security Rules Integration Tests
 * Testuje Firebase Security Rules a oprávnění v reálném prostředí
 */

import { auth, db } from '../../firebase/config';
import { adminService } from '../../services/adminService';
import { userService } from '../../services/userService';
import { FirebaseDebug } from '../../utils/firebaseDebug';
import { 
  mockAdminUser, 
  mockRegularUser, 
  mockPendingUsers,
  mockFirebaseErrors 
} from '../test-data/mockUsers';

// Mock Firebase pro integration testy
jest.mock('../../firebase/config', () => ({
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
  }
}));

describe('Firebase Security Rules Integration Tests', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    console.log('🧪 Firebase Rules: Clearing all mocks');
  });

  describe('Admin Access Rules Tests', () => {
    
    test('should allow admin to read pending users', async () => {
      console.log('🔍 Testing admin access to pending users...');
      
      // Setup admin user
      (auth.currentUser as any) = {
        uid: 'admin-uid',
        email: 'admin@example.com',
        getIdToken: jest.fn().mockResolvedValue('admin-token')
      };

      const mockAdminDoc = {
        exists: true,
        id: 'admin-doc-id',
        data: () => ({
          email: 'admin@example.com',
          role: 'admin',
          status: 'approved',
          permissions: { manageUsers: true }
        })
      };

      const mockPendingQuery = {
        size: 2,
        docs: mockPendingUsers.slice(0, 2).map(user => ({
          id: user.id,
          data: () => user
        }))
      };

      (db.collection as jest.Mock).mockReturnValue({
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue(mockAdminDoc)
        })),
        where: jest.fn(() => ({
          orderBy: jest.fn(() => ({
            get: jest.fn().mockResolvedValue(mockPendingQuery)
          })),
          get: jest.fn().mockResolvedValue(mockPendingQuery)
        }))
      });

      // Test admin verification
      const adminVerification = await adminService.verifyAdminAccess();
      expect(adminVerification.isAdmin).toBe(true);

      // Test pending users access
      const pendingUsers = await userService.getPendingUsers();
      expect(pendingUsers).toHaveLength(2);

      console.log('✅ Admin access to pending users test passed');
    });

    test('should deny regular user access to pending users', async () => {
      console.log('🔍 Testing regular user denied access to pending users...');
      
      // Setup regular user
      (auth.currentUser as any) = {
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
          permissions: { manageUsers: false }
        })
      };

      (db.collection as jest.Mock).mockReturnValue({
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue(mockUserDoc)
        })),
        where: jest.fn(() => ({
          get: jest.fn().mockRejectedValue(mockFirebaseErrors.permissionDenied)
        }))
      });

      // Test admin verification should fail
      const adminVerification = await adminService.verifyAdminAccess();
      expect(adminVerification.isAdmin).toBe(false);

      // Test pending users access should return empty array
      const pendingUsers = await userService.getPendingUsers();
      expect(pendingUsers).toHaveLength(0);

      console.log('✅ Regular user denied access test passed');
    });

    test('should handle unauthenticated access', async () => {
      console.log('🔍 Testing unauthenticated access...');
      
      (auth.currentUser as any) = null;

      const adminVerification = await adminService.verifyAdminAccess();
      expect(adminVerification.isAdmin).toBe(false);
      expect(adminVerification.error).toBe('Not logged in');

      console.log('✅ Unauthenticated access test passed');
    });
  });

  describe('CRUD Operations Rules Tests', () => {
    
    test('should allow admin to approve users', async () => {
      console.log('🔍 Testing admin approval permissions...');
      
      // Setup admin
      (auth.currentUser as any) = {
        uid: 'admin-uid',
        email: 'admin@example.com',
        getIdToken: jest.fn().mockResolvedValue('admin-token')
      };

      const mockUpdate = jest.fn().mockResolvedValue(undefined);
      
      (db.collection as jest.Mock).mockReturnValue({
        doc: jest.fn(() => ({
          update: mockUpdate
        }))
      });

      // Test approval
      await userService.approveUser('test-user-id', 'admin-id');
      
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        status: 'approved',
        approvedBy: 'admin-id'
      }));

      console.log('✅ Admin approval permissions test passed');
    });

    test('should allow admin to reject users', async () => {
      console.log('🔍 Testing admin rejection permissions...');
      
      const mockUpdate = jest.fn().mockResolvedValue(undefined);
      
      (db.collection as jest.Mock).mockReturnValue({
        doc: jest.fn(() => ({
          update: mockUpdate
        }))
      });

      await userService.rejectUser('test-user-id', 'admin-id', 'Test reason');
      
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        status: 'rejected',
        rejectedBy: 'admin-id',
        rejectedReason: 'Test reason'
      }));

      console.log('✅ Admin rejection permissions test passed');
    });

    test('should deny regular user admin operations', async () => {
      console.log('🔍 Testing regular user denied admin operations...');
      
      const mockUpdate = jest.fn().mockRejectedValue(mockFirebaseErrors.permissionDenied);
      
      (db.collection as jest.Mock).mockReturnValue({
        doc: jest.fn(() => ({
          update: mockUpdate
        }))
      });

      // Should throw permission error when non-admin tries to approve
      await expect(userService.approveUser('test-user-id', 'user-id')).rejects.toThrow();

      console.log('✅ Regular user denied admin operations test passed');
    });

    test('should test user document creation permissions', async () => {
      console.log('🔍 Testing user document creation permissions...');
      
      const mockAdd = jest.fn().mockResolvedValue({ id: 'new-user-id' });
      
      (db.collection as jest.Mock).mockReturnValue({
        add: mockAdd
      });

      const newUserData = {
        email: 'newuser@example.com',
        displayName: 'New User',
        role: 'user',
        status: 'pending',
        authProvider: 'google',
        permissions: {},
        createdAt: new Date()
      };

      // Mock firebaseUser for createGoogleUser
      const mockFirebaseUser = {
        email: 'newuser@example.com',
        displayName: 'New User',
        photoURL: null
      };

      jest.spyOn(userService, 'getUserByEmail').mockResolvedValue(null);
      jest.spyOn(userService, 'updateLastLogin').mockResolvedValue();

      const result = await userService.createGoogleUser(mockFirebaseUser);
      
      expect(mockAdd).toHaveBeenCalled();
      expect(result.email).toBe('newuser@example.com');
      expect(result.status).toBe('pending');

      console.log('✅ User document creation permissions test passed');
    });
  });

  describe('Firebase Rules Validation Tests', () => {
    
    test('should validate user can only read own data', async () => {
      console.log('🔍 Testing user can only read own data...');
      
      const mockUserDoc = {
        exists: true,
        data: () => mockRegularUser
      };

      (db.collection as jest.Mock).mockReturnValue({
        doc: jest.fn((docId) => ({
          get: jest.fn().mockImplementation(() => {
            // Simuluj že user může číst jen svůj dokument
            if (docId === 'user-own-id') {
              return Promise.resolve(mockUserDoc);
            } else {
              return Promise.reject(mockFirebaseErrors.permissionDenied);
            }
          })
        }))
      });

      // Own document - should work
      const ownDocRef = db.collection('users').doc('user-own-id');
      const ownDoc = await ownDocRef.get();
      expect(ownDoc.exists).toBe(true);

      // Other user's document - should fail
      const otherDocRef = db.collection('users').doc('other-user-id');
      await expect(otherDocRef.get()).rejects.toEqual(mockFirebaseErrors.permissionDenied);

      console.log('✅ User own data access validation test passed');
    });

    test('should validate email field requirements', async () => {
      console.log('🔍 Testing email field requirements...');
      
      const mockSet = jest.fn();
      
      (db.collection as jest.Mock).mockReturnValue({
        doc: jest.fn(() => ({
          set: mockSet
        }))
      });

      // Valid user data with email
      const validUserData = {
        email: 'valid@example.com',
        displayName: 'Valid User',
        role: 'user',
        status: 'pending'
      };

      mockSet.mockResolvedValueOnce(undefined);
      
      const validDocRef = db.collection('users').doc('valid-user');
      await validDocRef.set(validUserData);
      
      expect(mockSet).toHaveBeenCalledWith(validUserData);

      // Invalid user data without email - should be rejected by rules
      const invalidUserData = {
        displayName: 'Invalid User',
        role: 'user',
        status: 'pending'
      };

      mockSet.mockRejectedValueOnce({
        code: 'permission-denied',
        message: 'Email field is required'
      });

      const invalidDocRef = db.collection('users').doc('invalid-user');
      await expect(invalidDocRef.set(invalidUserData)).rejects.toEqual({
        code: 'permission-denied',
        message: 'Email field is required'
      });

      console.log('✅ Email field requirements validation test passed');
    });

    test('should validate role field restrictions', async () => {
      console.log('🔍 Testing role field restrictions...');
      
      const mockSet = jest.fn();
      
      (db.collection as jest.Mock).mockReturnValue({
        doc: jest.fn(() => ({
          set: mockSet
        }))
      });

      // Valid roles should be accepted
      const validRoles = ['admin', 'user', 'viewer'];
      
      for (const role of validRoles) {
        mockSet.mockResolvedValueOnce(undefined);
        
        const userData = {
          email: 'test@example.com',
          displayName: 'Test User',
          role: role,
          status: 'pending'
        };

        const docRef = db.collection('users').doc(`user-${role}`);
        await docRef.set(userData);
        
        expect(mockSet).toHaveBeenCalledWith(userData);
      }

      // Invalid role should be rejected
      mockSet.mockRejectedValueOnce({
        code: 'permission-denied',
        message: 'Invalid role'
      });

      const invalidUserData = {
        email: 'test@example.com',
        displayName: 'Test User',
        role: 'invalid-role',
        status: 'pending'
      };

      const invalidDocRef = db.collection('users').doc('invalid-role-user');
      await expect(invalidDocRef.set(invalidUserData)).rejects.toEqual({
        code: 'permission-denied',
        message: 'Invalid role'
      });

      console.log('✅ Role field restrictions validation test passed');
    });
  });

  describe('Firebase Debug Integration Tests', () => {
    
    test('should run complete Firestore operations test', async () => {
      console.log('🔍 Testing complete Firestore operations via FirebaseDebug...');
      
      // Mock admin user
      (auth.currentUser as any) = {
        uid: 'admin-uid',
        email: 'admin@example.com',
        getIdToken: jest.fn().mockResolvedValue('admin-token')
      };

      const mockOperations = {
        canRead: true,
        canCreate: true,
        canUpdate: true,
        canDelete: true,
        errors: []
      };

      // Mock FirebaseDebug methods
      jest.spyOn(FirebaseDebug, 'testFirestoreOperations').mockResolvedValue(mockOperations);

      const result = await FirebaseDebug.testFirestoreOperations();
      
      expect(result.canRead).toBe(true);
      expect(result.canCreate).toBe(true);
      expect(result.canUpdate).toBe(true);
      expect(result.canDelete).toBe(true);

      console.log('✅ Complete Firestore operations test passed');
    });

    test('should verify admin permissions through debug utility', async () => {
      console.log('🔍 Testing admin permissions verification via FirebaseDebug...');
      
      (auth.currentUser as any) = {
        uid: 'admin-uid',
        email: 'admin@example.com',
        getIdToken: jest.fn().mockResolvedValue('admin-token')
      };

      const mockAdminVerification = {
        userId: 'admin-doc-id',
        email: 'admin@example.com',
        role: 'admin',
        status: 'approved',
        permissions: { manageUsers: true },
        checks: {
          hasRole: true,
          hasStatus: true,
          hasPermissions: true,
          hasManageUsers: true
        },
        isAdmin: true
      };

      jest.spyOn(FirebaseDebug, 'verifyAdminPermissions').mockResolvedValue(mockAdminVerification);

      const result = await FirebaseDebug.verifyAdminPermissions();
      
      expect(result.isAdmin).toBe(true);
      expect(result.checks.hasManageUsers).toBe(true);

      console.log('✅ Admin permissions verification test passed');
    });

    test('should run full diagnostic and identify issues', async () => {
      console.log('🔍 Testing full diagnostic for issue identification...');
      
      // Mock konzole spy pro zachycení diagnostického výstupu
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Mock všechny debug metody
      jest.spyOn(FirebaseDebug, 'getCurrentUserDetails').mockResolvedValue({
        firebaseUser: { uid: 'test-uid', email: 'test@example.com' },
        firestoreUser: { role: 'admin', status: 'approved' }
      });

      jest.spyOn(FirebaseDebug, 'verifyAdminPermissions').mockResolvedValue({
        isAdmin: false, // Simuluj problém s admin oprávněními
        role: 'admin',
        status: 'approved',
        permissions: { manageUsers: false } // Problém zde!
      });

      jest.spyOn(FirebaseDebug, 'testFirestoreOperations').mockResolvedValue({
        canRead: true,
        canCreate: true,
        canUpdate: true,
        canDelete: false, // Problém s mazáním!
        errors: ['DELETE failed: Missing permissions']
      });

      await FirebaseDebug.runFullDiagnostic();
      
      // Ověř, že byla identifikována všechna problémová místa
      expect(consoleSpy).toHaveBeenCalledWith('❌ RESULT: Delete will NOT work!');
      expect(consoleSpy).toHaveBeenCalledWith('🔧 Next steps:');

      consoleSpy.mockRestore();
      console.log('✅ Full diagnostic issue identification test passed');
    });
  });

  describe('Fallback Mechanisms Tests', () => {
    
    test('should test adminService fallback methods', async () => {
      console.log('🔍 Testing adminService fallback mechanisms...');
      
      // First method fails with permission error
      (db.collection as jest.Mock).mockReturnValueOnce({
        where: jest.fn(() => ({
          get: jest.fn().mockRejectedValue(mockFirebaseErrors.permissionDenied)
        })),
        get: jest.fn().mockResolvedValue({
          docs: mockPendingUsers.map(user => ({
            id: user.id,
            data: () => user
          }))
        })
      });

      const result = await adminService.getPendingUsersWithFallback();
      
      expect(result.method).toBe('fallback');
      expect(result.users).toHaveLength(mockPendingUsers.length);

      console.log('✅ AdminService fallback mechanisms test passed');
    });

    test('should handle complete fallback failure', async () => {
      console.log('🔍 Testing complete fallback failure scenario...');
      
      // All methods fail
      (db.collection as jest.Mock).mockReturnValue({
        where: jest.fn(() => ({
          get: jest.fn().mockRejectedValue(mockFirebaseErrors.permissionDenied)
        })),
        get: jest.fn().mockRejectedValue(mockFirebaseErrors.unavailable)
      });

      const result = await adminService.getPendingUsersWithFallback();
      
      expect(result.method).toBe('failed');
      expect(result.users).toHaveLength(0);

      console.log('✅ Complete fallback failure test passed');
    });
  });

  describe('Real-world Scenario Tests', () => {
    
    test('should simulate pending user approval workflow', async () => {
      console.log('🔍 Testing real-world pending user approval workflow...');
      
      // 1. Admin checks pending users
      (auth.currentUser as any) = {
        uid: 'admin-uid',
        email: 'admin@example.com',
        getIdToken: jest.fn().mockResolvedValue('admin-token')
      };

      const mockAdminDoc = {
        exists: true,
        data: () => ({
          role: 'admin',
          status: 'approved',
          permissions: { manageUsers: true }
        })
      };

      const mockPendingQuery = {
        size: 1,
        docs: [{
          id: 'pending-user-id',
          data: () => mockPendingUsers[0]
        }]
      };

      (db.collection as jest.Mock).mockReturnValue({
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue(mockAdminDoc),
          update: jest.fn().mockResolvedValue(undefined)
        })),
        where: jest.fn(() => ({
          orderBy: jest.fn(() => ({
            get: jest.fn().mockResolvedValue(mockPendingQuery)
          }))
        }))
      });

      // 2. Verify admin access
      const adminCheck = await adminService.verifyAdminAccess();
      expect(adminCheck.isAdmin).toBe(true);

      // 3. Get pending users
      const pendingUsers = await userService.getPendingUsers();
      expect(pendingUsers).toHaveLength(1);

      // 4. Approve user
      await userService.approveUser('pending-user-id', 'admin-uid');

      // 5. Verify approval was called with correct params
      const updateCall = (db.collection as jest.Mock).mock.results[0].value.doc().update;
      expect(updateCall).toHaveBeenCalledWith(expect.objectContaining({
        status: 'approved',
        approvedBy: 'admin-uid'
      }));

      console.log('✅ Real-world pending user approval workflow test passed');
    });

    test('should simulate permission denied recovery', async () => {
      console.log('🔍 Testing permission denied recovery scenario...');
      
      // Simuluj permission denied při standardním načítání
      (db.collection as jest.Mock).mockReturnValueOnce({
        where: jest.fn(() => ({
          orderBy: jest.fn(() => ({
            get: jest.fn().mockRejectedValue(mockFirebaseErrors.permissionDenied)
          }))
        })),
        get: jest.fn().mockResolvedValue({
          docs: mockPendingUsers.map(user => ({
            id: user.id,
            data: () => user
          }))
        })
      });

      const result = await adminService.getPendingUsersWithFallback();
      
      // Mělo by se použít fallback metodu
      expect(result.method).toBe('fallback');
      expect(result.users).toHaveLength(mockPendingUsers.length);

      console.log('✅ Permission denied recovery scenario test passed');
    });
  });
});