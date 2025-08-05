/**
 * AuthContext Tests
 * Kompletní testování AuthContext provideru a všech jeho funkcí
 */

import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import { auth, db } from '../../firebase/config';
import { userService } from '../../services/userService';
import { 
  mockFirebaseUser, 
  mockAdminUser, 
  mockRegularUser, 
  mockPendingUsers,
  mockFirebaseErrors,
  mockFirestoreUsers
} from '../test-data/mockUsers';

// Mock Firebase config
jest.mock('../../firebase/config', () => ({
  auth: {
    currentUser: null,
    onAuthStateChanged: jest.fn(),
    signInWithEmailAndPassword: jest.fn(),
    signInWithPopup: jest.fn(),
    signOut: jest.fn()
  },
  db: {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(),
        set: jest.fn(),
        update: jest.fn()
      })),
      where: jest.fn(() => ({
        get: jest.fn()
      }))
    }))
  },
  googleProvider: {}
}));

// Mock userService
jest.mock('../../services/userService', () => ({
  userService: {
    createGoogleUser: jest.fn(),
    getUserByEmail: jest.fn(),
    updateLastLogin: jest.fn(),
    approveUser: jest.fn(),
    rejectUser: jest.fn(),
    getPendingUsers: jest.fn(),
    isAdmin: jest.fn()
  }
}));

const mockAuth = auth as jest.Mocked<typeof auth>;
const mockDb = db as jest.Mocked<typeof db>;
const mockUserService = userService as jest.Mocked<typeof userService>;

// Test component pro testování useAuth hook
const TestComponent: React.FC = () => {
  const authContext = useAuth();
  
  return (
    <div>
      <div data-testid="user-email">
        {authContext.currentUser?.email || 'No user'}
      </div>
      <div data-testid="user-role">
        {authContext.currentUser?.role || 'No role'}
      </div>
      <div data-testid="loading">
        {authContext.loading ? 'Loading' : 'Loaded'}
      </div>
      <button 
        data-testid="login-button" 
        onClick={() => authContext.login('test@example.com', 'password')}
      >
        Login
      </button>
      <button 
        data-testid="google-login-button" 
        onClick={() => authContext.loginWithGoogle()}
      >
        Google Login
      </button>
      <button 
        data-testid="logout-button" 
        onClick={() => authContext.logout()}
      >
        Logout
      </button>
      <button 
        data-testid="refresh-button" 
        onClick={() => authContext.refreshUser()}
      >
        Refresh
      </button>
    </div>
  );
};

describe('AuthContext Tests', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    console.log('🧪 AuthContext: Clearing all mocks');
    
    // Default mock setup
    mockAuth.onAuthStateChanged.mockImplementation((callback) => {
      // Simulace žádný uživatel na začátku  
      callback(null);
      return () => {}; // unsubscribe function
    });
  });

  describe('AuthProvider Initialization Tests', () => {
    
    test('should initialize with no user and loading false', async () => {
      console.log('🔍 Testing AuthProvider initialization...');
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-email')).toHaveTextContent('No user');
        expect(screen.getByTestId('loading')).toHaveTextContent('Loaded');
      });

      console.log('✅ AuthProvider initialization test passed');
    });

    test('should handle useAuth outside provider', () => {
      console.log('🔍 Testing useAuth outside provider error...');
      
      // Zachytí console.error
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        render(<TestComponent />);
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleSpy.mockRestore();
      console.log('✅ useAuth outside provider error test passed');
    });
  });

  describe('Authentication Flow Tests', () => {
    
    test('should handle email/password login successfully', async () => {
      console.log('🔍 Testing email/password login...');
      
      mockAuth.signInWithEmailAndPassword.mockResolvedValue({
        user: mockFirebaseUser
      } as any);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      const loginButton = screen.getByTestId('login-button');
      
      await act(async () => {
        loginButton.click();
      });

      expect(mockAuth.signInWithEmailAndPassword).toHaveBeenCalledWith(
        'test@example.com', 
        'password'
      );

      console.log('✅ Email/password login test passed');
    });

    test('should handle email/password login failure', async () => {
      console.log('🔍 Testing email/password login failure...');
      
      mockAuth.signInWithEmailAndPassword.mockRejectedValue(
        mockFirebaseErrors.authWrongPassword
      );

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      const loginButton = screen.getByTestId('login-button');
      
      await expect(async () => {
        await act(async () => {
          loginButton.click();
        });
      }).rejects.toThrow('Login failed:');

      console.log('✅ Email/password login failure test passed');
    });

    test('should handle Google OAuth login successfully', async () => {
      console.log('🔍 Testing Google OAuth login...');
      
      mockAuth.signInWithPopup.mockResolvedValue({
        user: mockFirebaseUser
      } as any);

      mockUserService.createGoogleUser.mockResolvedValue(mockRegularUser);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      const googleLoginButton = screen.getByTestId('google-login-button');
      
      await act(async () => {
        googleLoginButton.click();
      });

      expect(mockAuth.signInWithPopup).toHaveBeenCalled();
      expect(mockUserService.createGoogleUser).toHaveBeenCalledWith(mockFirebaseUser);

      console.log('✅ Google OAuth login test passed');
    });

    test('should handle Google OAuth popup closed error', async () => {
      console.log('🔍 Testing Google OAuth popup closed error...');
      
      mockAuth.signInWithPopup.mockRejectedValue(
        mockFirebaseErrors.authPopupClosedByUser
      );

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      const googleLoginButton = screen.getByTestId('google-login-button');
      
      await expect(async () => {
        await act(async () => {
          googleLoginButton.click();
        });
      }).rejects.toThrow('Přihlášení bylo zrušeno');

      console.log('✅ Google OAuth popup closed error test passed');
    });

    test('should handle logout successfully', async () => {
      console.log('🔍 Testing logout...');
      
      mockAuth.signOut.mockResolvedValue();

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      const logoutButton = screen.getByTestId('logout-button');
      
      await act(async () => {
        logoutButton.click();
      });

      expect(mockAuth.signOut).toHaveBeenCalled();

      console.log('✅ Logout test passed');
    });
  });

  describe('User Data Fetching Tests', () => {
    
    test('should fetch user data from userService', async () => {
      console.log('🔍 Testing user data fetching from userService...');
      
      mockUserService.getUserByEmail.mockResolvedValue(mockAdminUser);
      mockUserService.updateLastLogin.mockResolvedValue();

      // Setup auth state change to simulate user login
      mockAuth.onAuthStateChanged.mockImplementation((callback) => {
        callback(mockFirebaseUser as any);
        return () => {};
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(mockUserService.getUserByEmail).toHaveBeenCalledWith(mockFirebaseUser.email);
        expect(screen.getByTestId('user-email')).toHaveTextContent(mockAdminUser.email);
        expect(screen.getByTestId('user-role')).toHaveTextContent(mockAdminUser.role);
      });

      console.log('✅ User data fetching test passed');
    });

    test('should fallback to legacy user document', async () => {
      console.log('🔍 Testing legacy user document fallback...');
      
      mockUserService.getUserByEmail.mockResolvedValue(null);

      const mockLegacyDoc = {
        exists: true,
        data: () => mockFirestoreUsers['admin-doc-id-123']
      };

      mockDb.collection.mockReturnValue({
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue(mockLegacyDoc),
          update: jest.fn().mockResolvedValue(undefined)
        }))
      } as any);

      mockAuth.onAuthStateChanged.mockImplementation((callback) => {
        callback(mockFirebaseUser as any);
        return () => {};
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-email')).toHaveTextContent(mockFirestoreUsers['admin-doc-id-123'].email);
      });

      console.log('✅ Legacy user document fallback test passed');
    });

    test('should create minimal user when no document exists', async () => {
      console.log('🔍 Testing minimal user creation...');
      
      mockUserService.getUserByEmail.mockResolvedValue(null);

      const mockEmptyDoc = {
        exists: false
      };

      mockDb.collection.mockReturnValue({
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue(mockEmptyDoc),
          set: jest.fn().mockResolvedValue(undefined)
        }))
      } as any);

      mockAuth.onAuthStateChanged.mockImplementation((callback) => {
        callback(mockFirebaseUser as any);
        return () => {};
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-email')).toHaveTextContent(mockFirebaseUser.email);
        expect(screen.getByTestId('user-role')).toHaveTextContent('viewer');
      });

      console.log('✅ Minimal user creation test passed');
    });

    test('should handle user data fetch error gracefully', async () => {
      console.log('🔍 Testing user data fetch error handling...');
      
      mockUserService.getUserByEmail.mockRejectedValue(new Error('Database error'));

      mockDb.collection.mockReturnValue({
        doc: jest.fn(() => ({
          get: jest.fn().mockRejectedValue(new Error('Firestore error'))
        }))
      } as any);

      mockAuth.onAuthStateChanged.mockImplementation((callback) => {
        callback(mockFirebaseUser as any);
        return () => {};
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        // Měl by vytvořit fallback user
        expect(screen.getByTestId('user-email')).toHaveTextContent(mockFirebaseUser.email);
        expect(screen.getByTestId('user-role')).toHaveTextContent('viewer');
      });

      console.log('✅ User data fetch error handling test passed');
    });
  });

  describe('Admin Functions Tests', () => {
    
    test('should get pending users as admin', async () => {
      console.log('🔍 Testing get pending users as admin...');
      
      mockUserService.isAdmin.mockReturnValue(true);
      mockUserService.getPendingUsers.mockResolvedValue(mockPendingUsers);

      // Setup admin user
      mockAuth.onAuthStateChanged.mockImplementation((callback) => {
        callback(mockFirebaseUser as any);
        return () => {};
      });
      mockUserService.getUserByEmail.mockResolvedValue(mockAdminUser);

      const TestAdminComponent: React.FC = () => {
        const { getPendingUsers } = useAuth();
        const [users, setUsers] = React.useState<any[]>([]);
        
        React.useEffect(() => {
          getPendingUsers().then(setUsers);
        }, [getPendingUsers]);
        
        return <div data-testid="pending-count">{users.length}</div>;
      };

      render(
        <AuthProvider>
          <TestAdminComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('pending-count')).toHaveTextContent(mockPendingUsers.length.toString());
        expect(mockUserService.getPendingUsers).toHaveBeenCalled();
      });

      console.log('✅ Get pending users as admin test passed');
    });

    test('should reject pending users access for non-admin', async () => {
      console.log('🔍 Testing pending users access rejection for non-admin...');
      
      mockUserService.isAdmin.mockReturnValue(false);

      // Setup regular user
      mockAuth.onAuthStateChanged.mockImplementation((callback) => {
        callback(mockFirebaseUser as any);
        return () => {};
      });
      mockUserService.getUserByEmail.mockResolvedValue(mockRegularUser);

      const TestNonAdminComponent: React.FC = () => {
        const { getPendingUsers } = useAuth();
        const [error, setError] = React.useState('');
        
        React.useEffect(() => {
          getPendingUsers().catch((err) => setError(err.message));
        }, [getPendingUsers]);
        
        return <div data-testid="error">{error}</div>;
      };

      render(
        <AuthProvider>
          <TestNonAdminComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Insufficient permissions');
      });

      console.log('✅ Non-admin pending users access rejection test passed');
    });

    test('should approve user as admin', async () => {
      console.log('🔍 Testing user approval as admin...');
      
      mockUserService.isAdmin.mockReturnValue(true);
      mockUserService.approveUser.mockResolvedValue();

      // Setup admin user
      mockAuth.onAuthStateChanged.mockImplementation((callback) => {
        callback(mockFirebaseUser as any);
        return () => {};
      });
      mockUserService.getUserByEmail.mockResolvedValue(mockAdminUser);

      const TestApprovalComponent: React.FC = () => {
        const { approveUser } = useAuth();
        
        return (
          <button 
            data-testid="approve-button"
            onClick={() => approveUser('test-user-id')}
          >
            Approve
          </button>
        );
      };

      render(
        <AuthProvider>
          <TestApprovalComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        const approveButton = screen.getByTestId('approve-button');
        approveButton.click();
      });

      await waitFor(() => {
        expect(mockUserService.approveUser).toHaveBeenCalledWith('test-user-id', mockAdminUser.id);
      });

      console.log('✅ User approval as admin test passed');
    });

    test('should reject user as admin', async () => {
      console.log('🔍 Testing user rejection as admin...');
      
      mockUserService.isAdmin.mockReturnValue(true);
      mockUserService.rejectUser.mockResolvedValue();

      // Setup admin user
      mockAuth.onAuthStateChanged.mockImplementation((callback) => {
        callback(mockFirebaseUser as any);
        return () => {};
      });
      mockUserService.getUserByEmail.mockResolvedValue(mockAdminUser);

      const TestRejectionComponent: React.FC = () => {
        const { rejectUser } = useAuth();
        
        return (
          <button 
            data-testid="reject-button"
            onClick={() => rejectUser('test-user-id', 'Test reason')}
          >
            Reject
          </button>
        );
      };

      render(
        <AuthProvider>
          <TestRejectionComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        const rejectButton = screen.getByTestId('reject-button');
        rejectButton.click();
      });

      await waitFor(() => {
        expect(mockUserService.rejectUser).toHaveBeenCalledWith('test-user-id', mockAdminUser.id, 'Test reason');
      });

      console.log('✅ User rejection as admin test passed');
    });
  });

  describe('User Refresh Tests', () => {
    
    test('should refresh user data', async () => {
      console.log('🔍 Testing user data refresh...');
      
      mockUserService.getUserByEmail.mockResolvedValue(mockAdminUser);

      // Setup authenticated user
      mockAuth.currentUser = mockFirebaseUser as any;
      mockAuth.onAuthStateChanged.mockImplementation((callback) => {
        callback(mockFirebaseUser as any);
        return () => {};
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-email')).toHaveTextContent(mockAdminUser.email);
      });

      // Simuluj změnu uživatelských dat
      const updatedUser = { ...mockAdminUser, displayName: 'Updated Admin' };
      mockUserService.getUserByEmail.mockResolvedValue(updatedUser);

      const refreshButton = screen.getByTestId('refresh-button');
      
      await act(async () => {
        refreshButton.click();
      });

      // Měla by být zavolána getUserByEmail znovu
      expect(mockUserService.getUserByEmail).toHaveBeenCalledTimes(2);

      console.log('✅ User data refresh test passed');
    });

    test('should handle refresh when no user logged in', async () => {
      console.log('🔍 Testing refresh with no user logged in...');
      
      mockAuth.currentUser = null;

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      const refreshButton = screen.getByTestId('refresh-button');
      
      await act(async () => {
        refreshButton.click();
      });

      // getUserByEmail by neměla být zavolána
      expect(mockUserService.getUserByEmail).not.toHaveBeenCalled();

      console.log('✅ Refresh with no user test passed');
    });
  });

  describe('Initial Login Handling Tests', () => {
    
    test('should update lastLogin on initial login', async () => {
      console.log('🔍 Testing lastLogin update on initial login...');
      
      mockUserService.getUserByEmail.mockResolvedValue(mockAdminUser);
      mockUserService.updateLastLogin.mockResolvedValue();

      // Simuluj přihlášení
      mockAuth.signInWithEmailAndPassword.mockResolvedValue({
        user: mockFirebaseUser
      } as any);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      const loginButton = screen.getByTestId('login-button');
      
      await act(async () => {
        loginButton.click();
      });

      // Simuluj auth state change po přihlášení
      await act(async () => {
        const callback = mockAuth.onAuthStateChanged.mock.calls[0][0];
        callback(mockFirebaseUser as any);
      });

      await waitFor(() => {
        expect(mockUserService.updateLastLogin).toHaveBeenCalledWith(mockAdminUser.id);
      });

      console.log('✅ LastLogin update on initial login test passed');
    });
  });

  describe('Error Recovery Tests', () => {
    
    test('should recover from auth state change errors', async () => {
      console.log('🔍 Testing recovery from auth state change errors...');
      
      mockUserService.getUserByEmail.mockRejectedValue(new Error('Database error'));
      
      mockAuth.onAuthStateChanged.mockImplementation((callback) => {
        callback(mockFirebaseUser as any);
        return () => {};
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        // Měl by vytvořit fallback user profile
        expect(screen.getByTestId('user-email')).toHaveTextContent(mockFirebaseUser.email);
        expect(screen.getByTestId('user-role')).toHaveTextContent('viewer'); // Fallback role
      });

      console.log('✅ Auth state change error recovery test passed');
    });
  });

  describe('Integration Tests', () => {
    
    test('should complete full authentication flow', async () => {
      console.log('🔍 Testing complete authentication flow...');
      
      // 1. Initial state - no user
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId('user-email')).toHaveTextContent('No user');

      // 2. Login
      mockAuth.signInWithEmailAndPassword.mockResolvedValue({
        user: mockFirebaseUser
      } as any);

      const loginButton = screen.getByTestId('login-button');
      await act(async () => {
        loginButton.click();
      });

      // 3. Auth state change
      mockUserService.getUserByEmail.mockResolvedValue(mockAdminUser);
      mockUserService.updateLastLogin.mockResolvedValue();

      await act(async () => {
        const callback = mockAuth.onAuthStateChanged.mock.calls[0][0];
        callback(mockFirebaseUser as any);
      });

      // 4. User data loaded
      await waitFor(() => {
        expect(screen.getByTestId('user-email')).toHaveTextContent(mockAdminUser.email);
        expect(screen.getByTestId('user-role')).toHaveTextContent(mockAdminUser.role);
      });

      // 5. Logout
      mockAuth.signOut.mockResolvedValue();
      const logoutButton = screen.getByTestId('logout-button');
      
      await act(async () => {
        logoutButton.click();
      });

      // 6. Auth state change to null
      await act(async () => {
        const callback = mockAuth.onAuthStateChanged.mock.calls[0][0];
        callback(null);
      });

      // 7. Back to no user state
      await waitFor(() => {
        expect(screen.getByTestId('user-email')).toHaveTextContent('No user');
      });

      console.log('✅ Complete authentication flow test passed');
    });
  });
});