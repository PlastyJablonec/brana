// Camera module types
export interface CameraConfig {
  id: string;
  name: string;
  type: 'mjpeg' | 'snapshot' | 'rtsp' | 'onvif';
  streamUrl: string;
  snapshotUrl?: string;
  adminUrl?: string;
  username?: string;
  password?: string;
  fps?: number;
  quality?: number;
  timeout?: number;
  retryAttempts?: number;
}

export interface CameraStatus {
  id: string;
  status: 'online' | 'offline' | 'error' | 'connecting';
  lastSeen?: Date;
  error?: string;
  clientCount?: number;
}

export interface StreamClient {
  id: string;
  response: any;
  connectedAt: Date;
  lastActivity: Date;
}

export interface MJPEGBoundary {
  boundary: string;
  contentType: string;
  contentLength?: number;
}