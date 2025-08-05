/**
 * UserApprovalPanel Component Tests
 * Testuje kompletní funkcionalitu komponenty pro schvalování pending users
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import UserApprovalPanel from '../../components/UserApprovalPanel';
import { useAuth } from '../../contexts/AuthContext';
import { adminService } from '../../services/adminService';
import { 
  mockAdminUser, 
  mockRegularUser, 
  mockPendingUsers, 
  mockFirebaseErrors,
  testScenarios 
} from '../test-data/mockUsers';

// Mock dependencies
jest.mock('../../contexts/AuthContext');
jest.mock('../../services/adminService');

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockAdminService = adminService as jest.Mocked<typeof adminService>;

describe('UserApprovalPanel Component Tests', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    console.log('🧪 UserApprovalPanel: Clearing all mocks');
  });

  describe('Access Control Tests', () => {
    
    test('should not render for non-admin users', () => {
      console.log('🔍 Testing non-admin access control...');
      
      mockUseAuth.mockReturnValue({
        currentUser: mockRegularUser,
        loading: false,
        login: jest.fn(),
        loginWithGoogle: jest.fn(),
        logout: jest.fn(),
        refreshUser: jest.fn(),
        approveUser: jest.fn(),
        rejectUser: jest.fn(),
        getPendingUsers: jest.fn()
      });

      const { container } = render(<UserApprovalPanel />);
      expect(container.firstChild).toBeNull();
      console.log('✅ Non-admin access control test passed');
    });

    test('should render for admin users', () => {
      console.log('🔍 Testing admin access...');
      
      mockUseAuth.mockReturnValue({
        currentUser: mockAdminUser,
        loading: false,
        login: jest.fn(),
        loginWithGoogle: jest.fn(),
        logout: jest.fn(),
        refreshUser: jest.fn(),
        approveUser: jest.fn(),
        rejectUser: jest.fn(),
        getPendingUsers: jest.fn().mockResolvedValue(mockPendingUsers)
      });

      mockAdminService.verifyAdminAccess.mockResolvedValue({
        isAdmin: true,
        user: mockAdminUser
      });

      mockAdminService.getPendingUsersWithFallback.mockResolvedValue({
        users: mockPendingUsers,
        method: 'standard'
      });

      render(<UserApprovalPanel />);
      
      expect(screen.getByText(/Čekající uživatelé/i)).toBeInTheDocument();
      console.log('✅ Admin access test passed');
    });
  });

  describe('Loading States Tests', () => {
    
    test('should show loading spinner initially', () => {
      console.log('🔍 Testing loading state...');
      
      mockUseAuth.mockReturnValue({
        currentUser: mockAdminUser,
        loading: false,
        login: jest.fn(),
        loginWithGoogle: jest.fn(),
        logout: jest.fn(),
        refreshUser: jest.fn(),
        approveUser: jest.fn(),
        rejectUser: jest.fn(),
        getPendingUsers: jest.fn().mockImplementation(() => new Promise(() => {})) // Never resolves
      });

      mockAdminService.verifyAdminAccess.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<UserApprovalPanel />);
      
      expect(screen.getByText(/Načítám čekající uživatele/i)).toBeInTheDocument();
      console.log('✅ Loading state test passed');
    });
  });

  describe('Pending Users Display Tests', () => {
    
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        currentUser: mockAdminUser,
        loading: false,
        login: jest.fn(),
        loginWithGoogle: jest.fn(),
        logout: jest.fn(),
        refreshUser: jest.fn(),
        approveUser: jest.fn(),
        rejectUser: jest.fn(),
        getPendingUsers: jest.fn().mockResolvedValue(mockPendingUsers)
      });

      mockAdminService.verifyAdminAccess.mockResolvedValue({
        isAdmin: true,
        user: mockAdminUser
      });
    });

    test('should display pending users correctly', async () => {
      console.log('🔍 Testing pending users display...');
      
      mockAdminService.getPendingUsersWithFallback.mockResolvedValue({
        users: mockPendingUsers,
        method: 'standard'
      });

      render(<UserApprovalPanel />);
      
      await waitFor(() => {
        expect(screen.getByText(mockPendingUsers[0].displayName)).toBeInTheDocument();
        expect(screen.getByText(mockPendingUsers[0].email)).toBeInTheDocument();
      });

      // Ověř, že se zobrazují všichni pending users
      for (const user of mockPendingUsers) {
        expect(screen.getByText(user.displayName)).toBeInTheDocument();
        expect(screen.getByText(user.email)).toBeInTheDocument();
      }

      console.log('✅ Pending users display test passed');
    });

    test('should show empty state when no pending users', async () => {
      console.log('🔍 Testing empty pending users state...');
      
      mockAdminService.getPendingUsersWithFallback.mockResolvedValue({
        users: [],
        method: 'standard'
      });

      render(<UserApprovalPanel />);
      
      await waitFor(() => {
        expect(screen.getByText(/Žádní čekající uživatelé/i)).toBeInTheDocument();
        expect(screen.getByText(/Všichni uživatelé jsou schváleni nebo zamítnuti/i)).toBeInTheDocument();
      });

      console.log('✅ Empty state test passed');
    });

    test('should display user information correctly', async () => {
      console.log('🔍 Testing user information display...');
      
      mockAdminService.getPendingUsersWithFallback.mockResolvedValue({
        users: [mockPendingUsers[0]], // Test jen první user
        method: 'standard'
      });

      render(<UserApprovalPanel />);
      
      await waitFor(() => {
        const user = mockPendingUsers[0];
        
        // Základní informace
        expect(screen.getByText(user.displayName)).toBeInTheDocument();
        expect(screen.getByText(user.email)).toBeInTheDocument();
        expect(screen.getByText(user.role)).toBeInTheDocument();
        
        // Auth provider badge
        if (user.authProvider === 'google') {
          expect(screen.getByText('Google')).toBeInTheDocument();
        } else {
          expect(screen.getByText('Email')).toBeInTheDocument();
        }
        
        // Action buttons
        expect(screen.getByText(/Schválit/i)).toBeInTheDocument();
        expect(screen.getByText(/Zamítnout/i)).toBeInTheDocument();
      });

      console.log('✅ User information display test passed');
    });
  });

  describe('User Actions Tests', () => {
    
    const mockApproveUser = jest.fn();
    const mockRejectUser = jest.fn();
    const mockGetPendingUsers = jest.fn();

    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        currentUser: mockAdminUser,
        loading: false,
        login: jest.fn(),
        loginWithGoogle: jest.fn(),
        logout: jest.fn(),
        refreshUser: jest.fn(),
        approveUser: mockApproveUser,
        rejectUser: mockRejectUser,
        getPendingUsers: mockGetPendingUsers
      });

      mockAdminService.verifyAdminAccess.mockResolvedValue({
        isAdmin: true,
        user: mockAdminUser
      });

      mockAdminService.getPendingUsersWithFallback.mockResolvedValue({
        users: [mockPendingUsers[0]],
        method: 'standard'
      });
    });

    test('should approve user successfully', async () => {
      console.log('🔍 Testing user approval...');
      
      mockApproveUser.mockResolvedValue(undefined);
      mockGetPendingUsers.mockResolvedValue([]);

      render(<UserApprovalPanel />);
      
      await waitFor(() => {
        expect(screen.getByText(/Schválit/i)).toBeInTheDocument();
      });

      const approveButton = screen.getByText(/Schválit/i);
      fireEvent.click(approveButton);
      
      await waitFor(() => {
        expect(mockApproveUser).toHaveBeenCalledWith(mockPendingUsers[0].id);
      });

      console.log('✅ User approval test passed');
    });

    test('should reject user with reason', async () => {
      console.log('🔍 Testing user rejection...');
      
      mockRejectUser.mockResolvedValue(undefined);
      mockGetPendingUsers.mockResolvedValue([]);

      render(<UserApprovalPanel />);
      
      await waitFor(() => {
        expect(screen.getByText(/Zamítnout/i)).toBeInTheDocument();
      });

      // Klikni na Zamítnout
      const rejectButton = screen.getByText(/Zamítnout/i);
      fireEvent.click(rejectButton);
      
      // Měl by se objevit dialog
      await waitFor(() => {
        expect(screen.getByText(/Zamítnout uživatele/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/Např. Neověřená identita/i)).toBeInTheDocument();
      });

      // Zadej důvod
      const reasonTextarea = screen.getByPlaceholderText(/Např. Neověřená identita/i);
      fireEvent.change(reasonTextarea, { target: { value: 'Test reject reason' } });

      // Potvrď zamítnutí
      const confirmRejectButton = screen.getByRole('button', { name: /Zamítnout/i });
      fireEvent.click(confirmRejectButton);
      
      await waitFor(() => {
        expect(mockRejectUser).toHaveBeenCalledWith(mockPendingUsers[0].id, 'Test reject reason');
      });

      console.log('✅ User rejection test passed');
    });

    test('should handle approval error gracefully', async () => {
      console.log('🔍 Testing approval error handling...');
      
      mockApproveUser.mockRejectedValue(new Error('Approval failed'));

      // Mock window.alert
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});

      render(<UserApprovalPanel />);
      
      await waitFor(() => {
        expect(screen.getByText(/Schválit/i)).toBeInTheDocument();
      });

      const approveButton = screen.getByText(/Schválit/i);
      fireEvent.click(approveButton);
      
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Chyba při schvalování uživatele');
      });

      alertSpy.mockRestore();
      console.log('✅ Approval error handling test passed');
    });
  });

  describe('Fallback Loading Tests', () => {
    
    test('should use fallback when standard loading fails', async () => {
      console.log('🔍 Testing fallback loading mechanism...');
      
      const mockGetPendingUsers = jest.fn().mockRejectedValue(mockFirebaseErrors.permissionDenied);

      mockUseAuth.mockReturnValue({
        currentUser: mockAdminUser,
        loading: false,
        login: jest.fn(),
        loginWithGoogle: jest.fn(),
        logout: jest.fn(),
        refreshUser: jest.fn(),
        approveUser: jest.fn(),
        rejectUser: jest.fn(),
        getPendingUsers: mockGetPendingUsers
      });

      mockAdminService.verifyAdminAccess.mockResolvedValue({
        isAdmin: true,
        user: mockAdminUser
      });

      mockAdminService.getPendingUsersWithFallback.mockResolvedValue({
        users: mockPendingUsers,
        method: 'fallback'
      });

      render(<UserApprovalPanel />);
      
      await waitFor(() => {
        expect(screen.getByText(/Fallback: fallback/i)).toBeInTheDocument();
        expect(screen.getByText(mockPendingUsers[0].displayName)).toBeInTheDocument();
      });

      console.log('✅ Fallback loading test passed');
    });

    test('should handle admin verification failure', async () => {
      console.log('🔍 Testing admin verification failure...');
      
      mockUseAuth.mockReturnValue({
        currentUser: mockAdminUser,
        loading: false,
        login: jest.fn(),
        loginWithGoogle: jest.fn(),
        logout: jest.fn(),
        refreshUser: jest.fn(),
        approveUser: jest.fn(),
        rejectUser: jest.fn(),
        getPendingUsers: jest.fn()
      });

      mockAdminService.verifyAdminAccess.mockResolvedValue({
        isAdmin: false,
        user: null,
        error: 'Permission denied'
      });

      mockAdminService.getPendingUsersWithFallback.mockResolvedValue({
        users: [],
        method: 'failed'
      });

      render(<UserApprovalPanel />);
      
      await waitFor(() => {
        expect(screen.getByText(/Failed: Admin verification failed/i)).toBeInTheDocument();
      });

      console.log('✅ Admin verification failure test passed');
    });
  });

  describe('Debug Information Tests', () => {
    
    test('should display debug information', async () => {
      console.log('🔍 Testing debug information display...');
      
      mockUseAuth.mockReturnValue({
        currentUser: mockAdminUser,
        loading: false,
        login: jest.fn(),
        loginWithGoogle: jest.fn(),
        logout: jest.fn(),
        refreshUser: jest.fn(),
        approveUser: jest.fn(),
        rejectUser: jest.fn(),
        getPendingUsers: jest.fn().mockResolvedValue(mockPendingUsers)
      });

      mockAdminService.verifyAdminAccess.mockResolvedValue({
        isAdmin: true,
        user: mockAdminUser
      });

      mockAdminService.getPendingUsersWithFallback.mockResolvedValue({
        users: mockPendingUsers,
        method: 'standard'
      });

      render(<UserApprovalPanel />);
      
      await waitFor(() => {
        // Debug info by měl být viditelný
        expect(screen.getByText(/Metoda: Standard: AuthContext/i)).toBeInTheDocument();
        expect(screen.getByText('✅')).toBeInTheDocument(); // Admin verified checkmark
      });

      console.log('✅ Debug information display test passed');
    });

    test('should show error state in debug info', async () => {
      console.log('🔍 Testing error state in debug info...');
      
      mockUseAuth.mockReturnValue({
        currentUser: mockAdminUser,
        loading: false,
        login: jest.fn(),
        loginWithGoogle: jest.fn(),
        logout: jest.fn(),
        refreshUser: jest.fn(),
        approveUser: jest.fn(),
        rejectUser: jest.fn(),
        getPendingUsers: jest.fn().mockRejectedValue(new Error('Critical error'))
      });

      mockAdminService.verifyAdminAccess.mockRejectedValue(new Error('Verification failed'));

      render(<UserApprovalPanel />);
      
      await waitFor(() => {
        expect(screen.getByText(/Critical Error/i)).toBeInTheDocument();
        expect(screen.getByText('❌')).toBeInTheDocument(); // Error indicator
      });

      console.log('✅ Error state debug info test passed');
    });
  });

  describe('UI/UX Tests', () => {
    
    test('should show user count badge', async () => {
      console.log('🔍 Testing user count badge...');
      
      mockUseAuth.mockReturnValue({
        currentUser: mockAdminUser,
        loading: false,
        login: jest.fn(),
        loginWithGoogle: jest.fn(),
        logout: jest.fn(),
        refreshUser: jest.fn(),
        approveUser: jest.fn(),
        rejectUser: jest.fn(),
        getPendingUsers: jest.fn().mockResolvedValue(mockPendingUsers)
      });

      mockAdminService.verifyAdminAccess.mockResolvedValue({
        isAdmin: true,
        user: mockAdminUser
      });

      mockAdminService.getPendingUsersWithFallback.mockResolvedValue({
        users: mockPendingUsers,
        method: 'standard'
      });

      render(<UserApprovalPanel />);
      
      await waitFor(() => {
        expect(screen.getByText(mockPendingUsers.length.toString())).toBeInTheDocument();
      });

      console.log('✅ User count badge test passed');
    });

    test('should show proper auth provider badges', async () => {
      console.log('🔍 Testing auth provider badges...');
      
      mockAdminService.getPendingUsersWithFallback.mockResolvedValue({
        users: mockPendingUsers,
        method: 'standard'
      });

      mockUseAuth.mockReturnValue({
        currentUser: mockAdminUser,
        loading: false,
        login: jest.fn(),
        loginWithGoogle: jest.fn(),
        logout: jest.fn(),
        refreshUser: jest.fn(),
        approveUser: jest.fn(),
        rejectUser: jest.fn(),
        getPendingUsers: jest.fn().mockResolvedValue(mockPendingUsers)
      });

      mockAdminService.verifyAdminAccess.mockResolvedValue({
        isAdmin: true,
        user: mockAdminUser
      });

      render(<UserApprovalPanel />);
      
      await waitFor(() => {
        // Měly by být viditelné různé auth provider badges
        expect(screen.getByText('Google')).toBeInTheDocument();
        expect(screen.getByText('📧 Email')).toBeInTheDocument();
      });

      console.log('✅ Auth provider badges test passed');
    });
  });

  describe('Integration Tests', () => {
    
    test('should complete full user approval workflow', async () => {
      console.log('🔍 Testing complete user approval workflow...');
      
      const mockApproveUser = jest.fn().mockResolvedValue(undefined);
      const mockGetPendingUsers = jest.fn()
        .mockResolvedValueOnce(mockPendingUsers) // Initial load
        .mockResolvedValueOnce([]); // After approval

      mockUseAuth.mockReturnValue({
        currentUser: mockAdminUser,
        loading: false,
        login: jest.fn(),
        loginWithGoogle: jest.fn(),
        logout: jest.fn(),
        refreshUser: jest.fn(),
        approveUser: mockApproveUser,
        rejectUser: jest.fn(),
        getPendingUsers: mockGetPendingUsers
      });

      mockAdminService.verifyAdminAccess.mockResolvedValue({
        isAdmin: true,
        user: mockAdminUser
      });

      mockAdminService.getPendingUsersWithFallback
        .mockResolvedValueOnce({
          users: mockPendingUsers,
          method: 'standard'
        })
        .mockResolvedValueOnce({
          users: [],
          method: 'standard'
        });

      render(<UserApprovalPanel />);
      
      // 1. Initial load - měly by být viditelné pending users
      await waitFor(() => {
        expect(screen.getByText(mockPendingUsers[0].displayName)).toBeInTheDocument();
      });

      // 2. Schválení uživatele
      const approveButton = screen.getByText(/Schválit/i);
      fireEvent.click(approveButton);
      
      // 3. Ověření, že byla zavolána approval funkce
      await waitFor(() => {
        expect(mockApproveUser).toHaveBeenCalledWith(mockPendingUsers[0].id);
      });

      // 4. Po schválení by se měl seznam obnovit
      await waitFor(() => {
        expect(screen.getByText(/Žádní čekající uživatelé/i)).toBeInTheDocument();
      });

      console.log('✅ Complete user approval workflow test passed');
    });
  });
});