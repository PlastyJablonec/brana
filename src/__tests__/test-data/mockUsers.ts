/**
 * Mock Data pro Firebase testování
 * Obsahuje testovací uživatele pro různé scénáře
 */

import { User } from '../../types';
import { Timestamp } from 'firebase/firestore';

export const mockFirebaseUser = {
  uid: 'test-firebase-uid-123',
  email: 'test@example.com',
  emailVerified: true,
  displayName: 'Test User',
  photoURL: 'https://example.com/photo.jpg',
  providerId: 'google.com',
  getIdToken: jest.fn().mockResolvedValue('mock-firebase-token-12345')
};

export const mockAdminUser: User = {
  id: 'admin-doc-id-123',
  email: 'admin@example.com',
  displayName: 'Test Admin',
  photoURL: 'https://example.com/admin-photo.jpg',
  nick: 'TestAdmin',
  role: 'admin',
  status: 'approved',
  authProvider: 'google',
  permissions: {
    gate: true,
    garage: true,
    camera: true,
    stopMode: true,
    viewLogs: true,
    manageUsers: true, // Klíčové admin oprávnění
    viewGateActivity: true,
    requireLocation: false,
    allowGPS: true,
    requireLocationProximity: false
  },
  gpsEnabled: true,
  createdAt: new Date('2023-01-01T10:00:00Z'),
  lastLogin: new Date('2024-12-01T15:30:00Z'),
  approvedAt: new Date('2023-01-01T12:00:00Z'),
  approvedBy: 'system'
};

export const mockRegularUser: User = {
  id: 'user-doc-id-456',
  email: 'user@example.com',
  displayName: 'Regular User',
  role: 'user',
  status: 'approved',
  authProvider: 'email',
  permissions: {
    gate: true,
    garage: false,
    camera: true,
    stopMode: false,
    viewLogs: true,
    manageUsers: false, // Nemá admin oprávnění
    viewGateActivity: false,
    requireLocation: true,
    allowGPS: true,
    requireLocationProximity: true
  },
  gpsEnabled: true,
  createdAt: new Date('2023-06-15T09:00:00Z'),
  lastLogin: new Date('2024-12-01T14:20:00Z'),
  approvedAt: new Date('2023-06-15T11:30:00Z'),
  approvedBy: 'admin-doc-id-123'
};

export const mockPendingUsers: User[] = [
  {
    id: 'pending-user-1',
    email: 'pending1@example.com',
    displayName: 'Pending User 1',
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocExample1',
    role: 'user',
    status: 'pending',
    authProvider: 'google',
    permissions: {
      gate: false,
      garage: false,
      camera: false,
      stopMode: false,
      viewLogs: false,
      manageUsers: false,
      viewGateActivity: false,
      requireLocation: false,
      allowGPS: false,
      requireLocationProximity: false
    },
    gpsEnabled: false,
    createdAt: new Date('2024-11-20T08:15:00Z'),
    lastLogin: new Date('2024-11-20T08:15:00Z'),
    requestedAt: new Date('2024-11-20T08:15:00Z')
  },
  {
    id: 'pending-user-2',
    email: 'pending2@example.com',
    displayName: 'Pending User 2',
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
      viewGateActivity: false,
      requireLocation: false,
      allowGPS: false,
      requireLocationProximity: false
    },
    gpsEnabled: false,
    createdAt: new Date('2024-11-25T16:30:00Z'),
    lastLogin: new Date('2024-11-25T16:30:00Z'),
    requestedAt: new Date('2024-11-25T16:30:00Z')
  },
  {
    id: 'pending-user-3',
    email: 'pending3@example.com',
    displayName: 'Pending User 3',
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocExample3',
    role: 'user',
    status: 'pending',
    authProvider: 'google',
    permissions: {
      gate: false,
      garage: false,
      camera: false,
      stopMode: false,
      viewLogs: false,
      manageUsers: false,
      viewGateActivity: false,
      requireLocation: false,
      allowGPS: false,
      requireLocationProximity: false
    },
    gpsEnabled: false,
    createdAt: new Date('2024-12-01T10:45:00Z'),
    lastLogin: new Date('2024-12-01T10:45:00Z'),
    requestedAt: new Date('2024-12-01T10:45:00Z')
  }
];

export const mockRejectedUser: User = {
  id: 'rejected-user-789',
  email: 'rejected@example.com',
  displayName: 'Rejected User',
  role: 'user',
  status: 'rejected',
  authProvider: 'email',
  permissions: {
    gate: false,
    garage: false,
    camera: false,
    stopMode: false,
    viewLogs: false,
    manageUsers: false,
    viewGateActivity: false,
    requireLocation: false,
    allowGPS: false,
    requireLocationProximity: false
  },
  gpsEnabled: false,
  createdAt: new Date('2024-10-10T12:00:00Z'),
  lastLogin: new Date('2024-10-10T12:00:00Z'),
  requestedAt: new Date('2024-10-10T12:00:00Z'),
  rejectedAt: new Date('2024-10-11T09:30:00Z'),
  rejectedBy: 'admin-doc-id-123',
  rejectedReason: 'Neověřená identita'
};

/**
 * Mock Firestore dokumenty pro testování
 */
export const mockFirestoreUsers = {
  'admin-doc-id-123': {
    email: 'admin@example.com',
    displayName: 'Test Admin',
    photoURL: 'https://example.com/admin-photo.jpg',
    nick: 'TestAdmin',
    role: 'admin',
    status: 'approved',
    authProvider: 'google',
    permissions: {
      gate: true,
      garage: true,
      camera: true,
      stopMode: true,
      viewLogs: true,
      manageUsers: true,
      requireLocation: false,
      allowGPS: true,
      requireLocationProximity: false
    },
    gpsEnabled: true,
    createdAt: { toDate: () => new Date('2023-01-01T10:00:00Z') },
    lastLogin: { toDate: () => new Date('2024-12-01T15:30:00Z') },
    approvedAt: { toDate: () => new Date('2023-01-01T12:00:00Z') },
    approvedBy: 'system'
  },
  'user-doc-id-456': {
    email: 'user@example.com',
    displayName: 'Regular User',
    role: 'user',
    status: 'approved',
    authProvider: 'email',
    permissions: {
      gate: true,
      garage: false,
      camera: true,
      stopMode: false,
      viewLogs: true,
      manageUsers: false,
      requireLocation: true,
      allowGPS: true,
      requireLocationProximity: true
    },
    gpsEnabled: true,
    createdAt: { toDate: () => new Date('2023-06-15T09:00:00Z') },
    lastLogin: { toDate: () => new Date('2024-12-01T14:20:00Z') },
    approvedAt: { toDate: () => new Date('2023-06-15T11:30:00Z') },
    approvedBy: 'admin-doc-id-123'
  },
  'pending-user-1': {
    email: 'pending1@example.com',
    displayName: 'Pending User 1',
    photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocExample1',
    role: 'user',
    status: 'pending',
    authProvider: 'google',
    permissions: {
      gate: false,
      garage: false,
      camera: false,
      stopMode: false,
      viewLogs: false,
      manageUsers: false,
      viewGateActivity: false,
      requireLocation: false,
      allowGPS: false,
      requireLocationProximity: false
    },
    gpsEnabled: false,
    createdAt: { toDate: () => new Date('2024-11-20T08:15:00Z') },
    lastLogin: { toDate: () => new Date('2024-11-20T08:15:00Z') },
    requestedAt: { toDate: () => new Date('2024-11-20T08:15:00Z') }
  }
};

/**
 * Mock Firebase chyby pro testování error handling
 */
export const mockFirebaseErrors = {
  permissionDenied: {
    code: 'permission-denied',
    message: 'Missing or insufficient permissions.'
  },
  unauthenticated: {
    code: 'unauthenticated',
    message: 'The request was not authenticated.'
  },
  notFound: {
    code: 'not-found',
    message: 'No document to update.'
  },
  alreadyExists: {
    code: 'already-exists',
    message: 'Document already exists.'
  },
  unavailable: {
    code: 'unavailable',
    message: 'The service is currently unavailable.'
  },
  authWrongPassword: {
    code: 'auth/wrong-password',
    message: 'The password is invalid or the user does not have a password.'
  },
  authUserNotFound: {
    code: 'auth/user-not-found',
    message: 'There is no user record corresponding to this identifier.'
  },
  authPopupClosedByUser: {
    code: 'auth/popup-closed-by-user',
    message: 'The popup has been closed by the user before finalizing the operation.'
  }
};

/**
 * Pomocné funkce pro vytváření mock dat
 */
export const mockHelpers = {
  
  /**
   * Vytvoří mock Firestore QuerySnapshot
   */
  createQuerySnapshot: (docs: any[]) => ({
    empty: docs.length === 0,
    size: docs.length,
    docs: docs.map((data, index) => ({
      id: data.id || `doc-${index}`,
      data: () => data,
      exists: true
    }))
  }),

  /**
   * Vytvoří mock Firestore DocumentSnapshot
   */
  createDocSnapshot: (id: string, data: any, exists = true) => ({
    id,
    exists,
    data: () => exists ? data : undefined
  }),

  /**
   * Vytvoří mock Firebase user pro různé auth providery
   */
  createFirebaseUser: (email: string, provider: 'google' | 'email' = 'email') => ({
    uid: `uid-${email.replace('@', '-').replace('.', '-')}`,
    email,
    emailVerified: provider === 'google',
    displayName: provider === 'google' ? email.split('@')[0] : null,
    photoURL: provider === 'google' ? `https://lh3.googleusercontent.com/a/ACg8oc${email}` : null,
    providerId: provider === 'google' ? 'google.com' : 'password',
    getIdToken: jest.fn().mockResolvedValue(`token-${email}`)
  }),

  /**
   * Simuluje Firebase timestamp
   */
  createTimestamp: (date: Date) => ({
    toDate: () => date,
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: (date.getTime() % 1000) * 1000000
  })
};

/**
 * Test scénáře pro různé situace
 */
export const testScenarios = {
  
  // Úspěšné načtení pending users
  successfulPendingUsersLoad: {
    name: 'Successful Pending Users Load',
    mockData: mockPendingUsers,
    expectedResult: {
      success: true,
      userCount: 3,
      method: 'standard'
    }
  },

  // Prázdný seznam pending users
  emptyPendingUsers: {
    name: 'Empty Pending Users',
    mockData: [],
    expectedResult: {
      success: true,
      userCount: 0,
      method: 'standard'
    }
  },

  // Permission denied error
  permissionDeniedError: {
    name: 'Permission Denied Error',
    mockError: mockFirebaseErrors.permissionDenied,
    expectedResult: {
      success: false,
      fallbackRequired: true
    }
  },

  // Admin ověření úspěšné
  adminVerificationSuccess: {
    name: 'Admin Verification Success',
    mockUser: mockAdminUser,
    expectedResult: {
      isAdmin: true,
      hasManageUsers: true
    }
  },

  // Admin ověření neúspěšné
  adminVerificationFailed: {
    name: 'Admin Verification Failed',
    mockUser: mockRegularUser,
    expectedResult: {
      isAdmin: false,
      hasManageUsers: false
    }
  }
};

export default {
  mockFirebaseUser,
  mockAdminUser,
  mockRegularUser,
  mockPendingUsers,
  mockRejectedUser,
  mockFirestoreUsers,
  mockFirebaseErrors,
  mockHelpers,
  testScenarios
};