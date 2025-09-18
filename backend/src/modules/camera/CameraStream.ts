import { EventEmitter } from 'events';
import axios, { AxiosResponse } from 'axios';
import { CameraConfig, StreamClient, MJPEGBoundary } from './types';
import { logger } from '../../utils/logger';

export class CameraStream extends EventEmitter {
  private config: CameraConfig;
  private clients: Map<string, StreamClient> = new Map();
  private connectionAttempts: number = 0;
  private isConnected: boolean = false;
  private reconnectTimer?: NodeJS.Timeout;
  private streamBuffer: Buffer = Buffer.alloc(0);
  private boundary: string = '';
  private sourceStream?: any;

  constructor(config: CameraConfig) {
    super();
    this.config = config;
    this.boundary = `--boundary${Date.now()}`;
    
    // Automaticky spusť stream při vytvoření
    this.start().catch(error => {
      this.emit('error', error);
    });
  }

  async start(): Promise<void> {
    try {
      logger.info(`Starting camera stream for: ${this.config.id}`);
      await this.connectToCamera();
    } catch (error) {
      logger.error(`Failed to start camera stream for ${this.config.id}:`, error);
      this.scheduleReconnect();
      throw error;
    }
  }

  private async connectToCamera(): Promise<void> {
    try {
      this.connectionAttempts++;
      logger.debug(`Connecting to camera ${this.config.id}, attempt ${this.connectionAttempts}`);

      const auth = this.config.username ? {
        auth: {
          username: this.config.username,
          password: this.config.password || ''
        }
      } : {};

      const response = await axios.get(this.config.streamUrl, {
        ...auth,
        responseType: 'stream',
        timeout: this.config.timeout || 10000,
        headers: {
          'User-Agent': 'BranaCamera/1.0',
          'Accept': 'multipart/x-mixed-replace'
        }
      });

      this.sourceStream = response.data;
      this.isConnected = true;
      this.connectionAttempts = 0;
      
      logger.info(`Camera stream connected: ${this.config.id}`);
      this.emit('connected');

      this.setupStreamHandlers();

    } catch (error: any) {
      this.isConnected = false;
      const shouldRetry = this.connectionAttempts < (this.config.retryAttempts || 5);
      
      logger.error(`Camera connection failed for ${this.config.id}:`, error?.message || error);
      
      if (shouldRetry) {
        this.scheduleReconnect();
      } else {
        this.emit('error', new Error(`Max retry attempts reached for camera ${this.config.id}`));
      }
      
      throw error;
    }
  }

  private setupStreamHandlers(): void {
    if (!this.sourceStream) return;

    this.sourceStream.on('data', (chunk: Buffer) => {
      this.handleStreamData(chunk);
    });

    this.sourceStream.on('error', (error: Error) => {
      logger.error(`Camera stream error for ${this.config.id}:`, error);
      this.handleStreamError(error);
    });

    this.sourceStream.on('end', () => {
      logger.warn(`Camera stream ended for ${this.config.id}`);
      this.handleStreamEnd();
    });
  }

  private handleStreamData(chunk: Buffer): void {
    this.streamBuffer = Buffer.concat([this.streamBuffer, chunk]);
    this.processStreamBuffer();
  }

  private processStreamBuffer(): void {
    // Pokud je to snapshot camera, pošli celý buffer
    if (this.config.type === 'snapshot') {
      this.broadcastToClients(this.streamBuffer);
      this.streamBuffer = Buffer.alloc(0);
      return;
    }

    // Pro MJPEG stream, zpracuj MJPEG boundaries
    const boundaryMarker = Buffer.from('\r\n--');
    let boundaryIndex = this.streamBuffer.indexOf(boundaryMarker);
    
    while (boundaryIndex !== -1) {
      const frame = this.streamBuffer.slice(0, boundaryIndex);
      
      if (frame.length > 0) {
        this.broadcastToClients(frame);
      }
      
      this.streamBuffer = this.streamBuffer.slice(boundaryIndex + boundaryMarker.length);
      boundaryIndex = this.streamBuffer.indexOf(boundaryMarker);
    }
  }

  private broadcastToClients(data: Buffer): void {
    const timestamp = new Date();
    
    for (const [clientId, client] of this.clients) {
      try {
        if (client.response && !client.response.destroyed) {
          // MJPEG format header
          const header = `\r\n--${this.boundary}\r\nContent-Type: image/jpeg\r\nContent-Length: ${data.length}\r\n\r\n`;
          client.response.write(header);
          client.response.write(data);
          
          client.lastActivity = timestamp;
        } else {
          logger.debug(`Removing disconnected client: ${clientId}`);
          this.removeClient(clientId);
        }
      } catch (error) {
        logger.error(`Error broadcasting to client ${clientId}:`, error);
        this.removeClient(clientId);
      }
    }
  }

  private handleStreamError(error: Error): void {
    this.isConnected = false;
    this.emit('error', error);
    this.scheduleReconnect();
  }

  private handleStreamEnd(): void {
    this.isConnected = false;
    this.emit('close');
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const delay = Math.min(1000 * Math.pow(2, this.connectionAttempts), 30000); // Exponential backoff, max 30s
    
    logger.info(`Scheduling reconnect for camera ${this.config.id} in ${delay}ms`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connectToCamera().catch(error => {
        logger.error(`Reconnect failed for camera ${this.config.id}:`, error);
      });
    }, delay);
  }

  addClient(clientId: string, response: any): void {
    const client: StreamClient = {
      id: clientId,
      response,
      connectedAt: new Date(),
      lastActivity: new Date()
    };

    this.clients.set(clientId, client);
    
    // Pošli MJPEG headers
    response.writeHead(200, {
      'Content-Type': `multipart/x-mixed-replace; boundary=${this.boundary}`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Connection': 'keep-alive'
    });

    logger.info(`Client ${clientId} connected to camera stream ${this.config.id}`);
    this.emit('client:connected', clientId);

    // Cleanup při odpojení klienta
    response.on('close', () => {
      this.removeClient(clientId);
    });

    response.on('error', () => {
      this.removeClient(clientId);
    });
  }

  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        if (client.response && !client.response.destroyed) {
          client.response.end();
        }
      } catch (error) {
        logger.debug(`Error closing client response for ${clientId}:`, error);
      }
      
      this.clients.delete(clientId);
      logger.info(`Client ${clientId} disconnected from camera stream ${this.config.id}`);
      this.emit('client:disconnected', clientId);
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }

  getStatus(): { connected: boolean; clientCount: number; connectionAttempts: number } {
    return {
      connected: this.isConnected,
      clientCount: this.clients.size,
      connectionAttempts: this.connectionAttempts
    };
  }

  close(): void {
    logger.info(`Closing camera stream for: ${this.config.id}`);
    
    // Cleanup reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    // Disconnect all clients
    for (const [clientId] of this.clients) {
      this.removeClient(clientId);
    }

    // Close source stream
    if (this.sourceStream && typeof this.sourceStream.destroy === 'function') {
      this.sourceStream.destroy();
    }

    this.isConnected = false;
    this.emit('close');
  }
}