// Global type definitions for the Gate Control application

import { User as FirebaseUser } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';

// ===== AUTHENTICATION TYPES =====
export interface IAuthUser extends FirebaseUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

// User approval status types
export type UserStatus = 'pending' | 'approved' | 'rejected';

export type AuthProvider = 'google' | 'email';

// User interface with Google OAuth + approval workflow
export interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string; // Google profile picture
  nick?: string;
  role: 'admin' | 'user' | 'viewer';
  status: UserStatus; // New: approval status
  authProvider: AuthProvider; // New: how user registered
  
  permissions: {
    gate: boolean;
    garage: boolean;
    camera: boolean;
    stopMode: boolean;
    viewLogs: boolean;
    manageUsers: boolean;
    requireLocation: boolean;
    allowGPS: boolean;
    requireLocationProximity: boolean;
  };
  gpsEnabled: boolean;
  
  // Approval workflow timestamps
  createdAt: Date;
  lastLogin: Date;
  requestedAt?: Date; // When user requested access
  approvedAt?: Date; // When admin approved
  approvedBy?: string; // Which admin approved
  rejectedAt?: Date; // When admin rejected
  rejectedBy?: string; // Which admin rejected
  rejectedReason?: string; // Why rejected
}

export interface IAuthContext {
  currentUser: User | null;  // Return legacy User for compatibility
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>; // New: Google OAuth login
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  
  // User management methods for admins
  approveUser: (userId: string) => Promise<void>;
  rejectUser: (userId: string, reason?: string) => Promise<void>;
  getPendingUsers: () => Promise<User[]>;
}

// ===== THEME TYPES =====
export type ThemeMode = 'light' | 'dark' | 'auto';

export interface IThemeContext {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  isDark: boolean;
}

// ===== MQTT TYPES =====
export type GateStatusType = 
  | 'Brána zavřena' 
  | 'Brána otevřena' 
  | 'Otevírá se...' 
  | 'Zavírá se...' 
  | 'Zastavena' 
  | 'STOP režim' 
  | 'Neznámý stav';

export type GarageStatusType = 
  | 'Garáž zavřena' 
  | 'Garáž otevřena' 
  | 'Garáž - otevírä se...' 
  | 'Garáž - zavírá se...' 
  | 'Neznámý stav';

export interface IMqttStatus {
  gateStatus: GateStatusType;
  garageStatus: GarageStatusType;
  isConnected: boolean;
}

// ===== LOCATION TYPES =====
export interface ICoordinates {
  latitude: number;
  longitude: number;
}

export interface ILocationData {
  coordinates: ICoordinates;
  accuracy: number;
  timestamp: number;
}

// ===== COMPONENT PROPS TYPES =====
export interface IProtectedRouteProps {
  children: React.ReactNode;
}

export interface ILoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
}

export interface IErrorFallbackProps {
  error?: Error;
  onRetry?: () => void;
}

// ===== HOOK TYPES =====
export interface IAsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export interface IAsyncOperation<T> extends IAsyncState<T> {
  execute: () => Promise<void>;
  reset: () => void;
}