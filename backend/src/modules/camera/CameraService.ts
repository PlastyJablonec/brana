import axios from 'axios';
import { EventEmitter } from 'events';
import NodeCache from 'node-cache';
import { CameraConfig, CameraStatus } from './types';
import { CameraStream } from './CameraStream';
import { logger } from '../../utils/logger';

export class CameraService extends EventEmitter {
  private cameras: Map<string, CameraConfig> = new Map();
  private activeStreams: Map<string, CameraStream> = new Map();
  private snapshotCache: NodeCache;
  private statusCache: Map<string, CameraStatus> = new Map();
  
  constructor() {
    super();
    // Cache snapshots for 1 second to reduce camera load
    this.snapshotCache = new NodeCache({ stdTTL: 1, checkperiod: 2 });
    
    // Initialize with default camera from env
    this.initializeDefaultCamera();
  }

  private initializeDefaultCamera(): void {
    const defaultCamera: CameraConfig = {
      id: 'main-camera',
      name: 'Brána Camera',
      type: 'mjpeg',
      streamUrl: 'http://89.24.76.191:10180/photo.jpg',
      snapshotUrl: 'http://89.24.76.191:10180/photo.jpg',
      adminUrl: 'http://89.24.76.191:10180',
      timeout: 5000,
      retryAttempts: 5
    };
    
    this.addCamera(defaultCamera).catch(error => {
      logger.warn('Default camera not available:', error.message);
    });
  }

  async addCamera(config: CameraConfig): Promise<void> {
    try {
      // Validate camera connection
      await this.validateCamera(config);
      this.cameras.set(config.id, config);
      
      // Initialize status
      this.statusCache.set(config.id, {
        id: config.id,
        status: 'online',
        lastSeen: new Date(),
        clientCount: 0
      });
      
      logger.info(`Camera added: ${config.name} (${config.id})`);
      this.emit('camera:added', config.id);
    } catch (error: any) {
      logger.error(`Failed to add camera ${config.id}:`, error);
      
      // Add camera as offline
      this.cameras.set(config.id, config);
      this.statusCache.set(config.id, {
        id: config.id,
        status: 'offline',
        error: error?.message || 'Unknown error'
      });
      
      this.emit('camera:error', { cameraId: config.id, error });
      throw error;
    }
  }

  private async validateCamera(config: CameraConfig): Promise<void> {
    try {
      const auth = config.username ? {
        auth: {
          username: config.username,
          password: config.password || ''
        }
      } : {};

      logger.debug(`Validating camera: ${config.streamUrl}`);
      
      const response = await axios.get(config.streamUrl, {
        ...auth,
        timeout: config.timeout || 5000,
        responseType: 'stream',
        maxRedirects: 5,
        headers: {
          'User-Agent': 'BranaCamera/1.0'
        }
      });

      // Immediately close the stream after validation
      response.data.destroy();
      logger.debug(`Camera validation successful: ${config.id}`);
      
    } catch (error: any) {
      logger.error(`Camera validation failed for ${config.id}:`, error?.message || error);
      throw new Error(`Camera validation failed: ${error?.message || 'Unknown error'}`);
    }
  }

  // Create proxied MJPEG stream
  createMjpegStream(cameraId: string): CameraStream {
    const camera = this.cameras.get(cameraId);
    if (!camera) {
      throw new Error(`Camera not found: ${cameraId}`);
    }

    // Return existing stream if active
    if (this.activeStreams.has(cameraId)) {
      const existingStream = this.activeStreams.get(cameraId)!;
      logger.debug(`Reusing existing stream for camera: ${cameraId}`);
      return existingStream;
    }

    logger.info(`Creating new MJPEG stream for camera: ${cameraId}`);
    const stream = new CameraStream(camera);
    this.activeStreams.set(cameraId, stream);
    
    // Update status
    const status = this.statusCache.get(cameraId);
    if (status) {
      status.clientCount = (status.clientCount || 0) + 1;
      this.statusCache.set(cameraId, status);
    }
    
    stream.on('error', (error) => {
      logger.error(`Camera stream error for ${cameraId}:`, error);
      this.updateCameraStatus(cameraId, 'error', error.message);
      this.activeStreams.delete(cameraId);
      this.emit('camera:error', { cameraId, error });
    });

    stream.on('close', () => {
      logger.info(`Camera stream closed for: ${cameraId}`);
      this.activeStreams.delete(cameraId);
      this.updateCameraStatus(cameraId, 'offline');
    });

    stream.on('connected', () => {
      logger.info(`Camera stream connected for: ${cameraId}`);
      this.updateCameraStatus(cameraId, 'online');
    });

    return stream;
  }

  // Get single snapshot with caching
  async getSnapshot(cameraId: string): Promise<Buffer> {
    const cacheKey = `snapshot_${cameraId}`;
    const cached = this.snapshotCache.get<Buffer>(cacheKey);
    
    if (cached) {
      logger.debug(`Returning cached snapshot for: ${cameraId}`);
      return cached;
    }

    const camera = this.cameras.get(cameraId);
    if (!camera) {
      throw new Error(`Camera not found: ${cameraId}`);
    }

    const url = camera.snapshotUrl || camera.streamUrl;
    
    try {
      logger.debug(`Fetching snapshot from: ${url}`);
      
      const auth = camera.username ? {
        auth: {
          username: camera.username,
          password: camera.password || ''
        }
      } : {};

      const response = await axios.get(url, {
        ...auth,
        responseType: 'arraybuffer',
        timeout: camera.timeout || 5000,
        headers: {
          'User-Agent': 'BranaCamera/1.0'
        }
      });

      const buffer = Buffer.from(response.data);
      this.snapshotCache.set(cacheKey, buffer);
      
      // Update status
      this.updateCameraStatus(cameraId, 'online');
      
      logger.debug(`Snapshot fetched successfully: ${buffer.length} bytes`);
      return buffer;
      
    } catch (error: any) {
      logger.error(`Failed to get snapshot for ${cameraId}:`, error?.message || error);
      this.updateCameraStatus(cameraId, 'error', error?.message || 'Unknown error');
      throw new Error(`Failed to get snapshot: ${error?.message || 'Unknown error'}`);
    }
  }

  private updateCameraStatus(cameraId: string, status: CameraStatus['status'], error?: string): void {
    const currentStatus = this.statusCache.get(cameraId);
    const updatedStatus: CameraStatus = {
      ...currentStatus,
      id: cameraId,
      status,
      lastSeen: new Date(),
      error: error || undefined
    };
    
    this.statusCache.set(cameraId, updatedStatus);
    this.emit('camera:status', updatedStatus);
  }

  // Get camera status
  getCameraStatus(cameraId: string): CameraStatus | null {
    return this.statusCache.get(cameraId) || null;
  }

  // Get all cameras
  getAllCameras(): CameraConfig[] {
    return Array.from(this.cameras.values());
  }

  // Get all camera statuses
  getAllStatuses(): CameraStatus[] {
    return Array.from(this.statusCache.values());
  }

  // Remove camera
  removeCamera(cameraId: string): boolean {
    const stream = this.activeStreams.get(cameraId);
    if (stream) {
      stream.close();
      this.activeStreams.delete(cameraId);
    }
    
    this.statusCache.delete(cameraId);
    const removed = this.cameras.delete(cameraId);
    
    if (removed) {
      logger.info(`Camera removed: ${cameraId}`);
      this.emit('camera:removed', cameraId);
    }
    
    return removed;
  }

  // Cleanup
  async cleanup(): Promise<void> {
    logger.info('Cleaning up camera service...');
    
    // Close all active streams
    for (const [cameraId, stream] of this.activeStreams) {
      logger.debug(`Closing stream for camera: ${cameraId}`);
      stream.close();
    }
    
    this.activeStreams.clear();
    this.statusCache.clear();
    this.snapshotCache.flushAll();
    
    logger.info('Camera service cleanup complete');
  }
}