"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CameraStream = void 0;
const events_1 = require("events");
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../../utils/logger");
class CameraStream extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.clients = new Map();
        this.connectionAttempts = 0;
        this.isConnected = false;
        this.streamBuffer = Buffer.alloc(0);
        this.boundary = '';
        this.config = config;
        this.boundary = `--boundary${Date.now()}`;
        this.start().catch(error => {
            this.emit('error', error);
        });
    }
    async start() {
        try {
            logger_1.logger.info(`Starting camera stream for: ${this.config.id}`);
            await this.connectToCamera();
        }
        catch (error) {
            logger_1.logger.error(`Failed to start camera stream for ${this.config.id}:`, error);
            this.scheduleReconnect();
            throw error;
        }
    }
    async connectToCamera() {
        try {
            this.connectionAttempts++;
            logger_1.logger.debug(`Connecting to camera ${this.config.id}, attempt ${this.connectionAttempts}`);
            const auth = this.config.username ? {
                auth: {
                    username: this.config.username,
                    password: this.config.password || ''
                }
            } : {};
            const response = await axios_1.default.get(this.config.streamUrl, {
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
            logger_1.logger.info(`Camera stream connected: ${this.config.id}`);
            this.emit('connected');
            this.setupStreamHandlers();
        }
        catch (error) {
            this.isConnected = false;
            const shouldRetry = this.connectionAttempts < (this.config.retryAttempts || 5);
            logger_1.logger.error(`Camera connection failed for ${this.config.id}:`, error?.message || error);
            if (shouldRetry) {
                this.scheduleReconnect();
            }
            else {
                this.emit('error', new Error(`Max retry attempts reached for camera ${this.config.id}`));
            }
            throw error;
        }
    }
    setupStreamHandlers() {
        if (!this.sourceStream)
            return;
        this.sourceStream.on('data', (chunk) => {
            this.handleStreamData(chunk);
        });
        this.sourceStream.on('error', (error) => {
            logger_1.logger.error(`Camera stream error for ${this.config.id}:`, error);
            this.handleStreamError(error);
        });
        this.sourceStream.on('end', () => {
            logger_1.logger.warn(`Camera stream ended for ${this.config.id}`);
            this.handleStreamEnd();
        });
    }
    handleStreamData(chunk) {
        this.streamBuffer = Buffer.concat([this.streamBuffer, chunk]);
        this.processStreamBuffer();
    }
    processStreamBuffer() {
        if (this.config.type === 'snapshot') {
            this.broadcastToClients(this.streamBuffer);
            this.streamBuffer = Buffer.alloc(0);
            return;
        }
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
    broadcastToClients(data) {
        const timestamp = new Date();
        for (const [clientId, client] of this.clients) {
            try {
                if (client.response && !client.response.destroyed) {
                    const header = `\r\n--${this.boundary}\r\nContent-Type: image/jpeg\r\nContent-Length: ${data.length}\r\n\r\n`;
                    client.response.write(header);
                    client.response.write(data);
                    client.lastActivity = timestamp;
                }
                else {
                    logger_1.logger.debug(`Removing disconnected client: ${clientId}`);
                    this.removeClient(clientId);
                }
            }
            catch (error) {
                logger_1.logger.error(`Error broadcasting to client ${clientId}:`, error);
                this.removeClient(clientId);
            }
        }
    }
    handleStreamError(error) {
        this.isConnected = false;
        this.emit('error', error);
        this.scheduleReconnect();
    }
    handleStreamEnd() {
        this.isConnected = false;
        this.emit('close');
        this.scheduleReconnect();
    }
    scheduleReconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }
        const delay = Math.min(1000 * Math.pow(2, this.connectionAttempts), 30000);
        logger_1.logger.info(`Scheduling reconnect for camera ${this.config.id} in ${delay}ms`);
        this.reconnectTimer = setTimeout(() => {
            this.connectToCamera().catch(error => {
                logger_1.logger.error(`Reconnect failed for camera ${this.config.id}:`, error);
            });
        }, delay);
    }
    addClient(clientId, response) {
        const client = {
            id: clientId,
            response,
            connectedAt: new Date(),
            lastActivity: new Date()
        };
        this.clients.set(clientId, client);
        response.writeHead(200, {
            'Content-Type': `multipart/x-mixed-replace; boundary=${this.boundary}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Connection': 'keep-alive'
        });
        logger_1.logger.info(`Client ${clientId} connected to camera stream ${this.config.id}`);
        this.emit('client:connected', clientId);
        response.on('close', () => {
            this.removeClient(clientId);
        });
        response.on('error', () => {
            this.removeClient(clientId);
        });
    }
    removeClient(clientId) {
        const client = this.clients.get(clientId);
        if (client) {
            try {
                if (client.response && !client.response.destroyed) {
                    client.response.end();
                }
            }
            catch (error) {
                logger_1.logger.debug(`Error closing client response for ${clientId}:`, error);
            }
            this.clients.delete(clientId);
            logger_1.logger.info(`Client ${clientId} disconnected from camera stream ${this.config.id}`);
            this.emit('client:disconnected', clientId);
        }
    }
    getClientCount() {
        return this.clients.size;
    }
    getStatus() {
        return {
            connected: this.isConnected,
            clientCount: this.clients.size,
            connectionAttempts: this.connectionAttempts
        };
    }
    close() {
        logger_1.logger.info(`Closing camera stream for: ${this.config.id}`);
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
        for (const [clientId] of this.clients) {
            this.removeClient(clientId);
        }
        if (this.sourceStream && typeof this.sourceStream.destroy === 'function') {
            this.sourceStream.destroy();
        }
        this.isConnected = false;
        this.emit('close');
    }
}
exports.CameraStream = CameraStream;
//# sourceMappingURL=CameraStream.js.map