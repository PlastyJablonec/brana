export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  permissions: UserPermissions;
  gpsEnabled: boolean;
  allowedLocation?: {
    latitude: number;
    longitude: number;
    radius: number; // in meters
  };
  createdAt: Date;
  lastLogin?: Date;
}

export interface UserPermissions {
  gate: boolean;
  garage: boolean;
  camera: boolean;
  stopMode: boolean;
  viewLogs: boolean;
  manageUsers: boolean;
  requireLocation: boolean;
  allowGPS: boolean;
}

export type UserRole = 'admin' | 'operator' | 'viewer';

export interface ActivityLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  target: 'gate' | 'garage' | 'system';
  timestamp: Date;
  location?: {
    latitude: number;
    longitude: number;
  };
  success: boolean;
  details?: string;
}

export interface GateStatus {
  status: string;
  lastUpdate: Date;
  lastOperatedBy?: string;
  isMoving: boolean;
}

export interface GarageStatus {
  status: string;
  lastUpdate: Date;
  lastOperatedBy?: string;
  isMoving: boolean;
}

export interface AppState {
  gate: GateStatus;
  garage: GarageStatus;
  stopModeActive: boolean;
  stopModeStartTime?: Date;
}