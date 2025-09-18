"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CameraService = void 0;
const axios_1 = __importDefault(require("axios"));
const events_1 = require("events");
const node_cache_1 = __importDefault(require("node-cache"));
const CameraStream_1 = require("./CameraStream");
const logger_1 = require("../../utils/logger");
class CameraService extends events_1.EventEmitter {
    constructor() {
        super();
        this.cameras = new Map();
        this.activeStreams = new Map();
        this.statusCache = new Map();
        this.snapshotCache = new node_cache_1.default({ stdTTL: 1, checkperiod: 2 });
        this.initializeDefaultCamera();
    }
    initializeDefaultCamera() {
        const defaultCamera = {
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
            logger_1.logger.warn('Default camera not available:', error.message);
        });
    }
    async addCamera(config) {
        try {
            await this.validateCamera(config);
            this.cameras.set(config.id, config);
            this.statusCache.set(config.id, {
                id: config.id,
                status: 'online',
                lastSeen: new Date(),
                clientCount: 0
            });
            logger_1.logger.info(`Camera added: ${config.name} (${config.id})`);
            this.emit('camera:added', config.id);
        }
        catch (error) {
            logger_1.logger.error(`Failed to add camera ${config.id}:`, error);
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
    async validateCamera(config) {
        try {
            const auth = config.username ? {
                auth: {
                    username: config.username,
                    password: config.password || ''
                }
            } : {};
            logger_1.logger.debug(`Validating camera: ${config.streamUrl}`);
            const response = await axios_1.default.get(config.streamUrl, {
                ...auth,
                timeout: config.timeout || 5000,
                responseType: 'stream',
                maxRedirects: 5,
                headers: {
                    'User-Agent': 'BranaCamera/1.0'
                }
            });
            response.data.destroy();
            logger_1.logger.debug(`Camera validation successful: ${config.id}`);
        }
        catch (error) {
            logger_1.logger.error(`Camera validation failed for ${config.id}:`, error?.message || error);
            throw new Error(`Camera validation failed: ${error?.message || 'Unknown error'}`);
        }
    }
    createMjpegStream(cameraId) {
        const camera = this.cameras.get(cameraId);
        if (!camera) {
            throw new Error(`Camera not found: ${cameraId}`);
        }
        if (this.activeStreams.has(cameraId)) {
            const existingStream = this.activeStreams.get(cameraId);
            logger_1.logger.debug(`Reusing existing stream for camera: ${cameraId}`);
            return existingStream;
        }
        logger_1.logger.info(`Creating new MJPEG stream for camera: ${cameraId}`);
        const stream = new CameraStream_1.CameraStream(camera);
        this.activeStreams.set(cameraId, stream);
        const status = this.statusCache.get(cameraId);
        if (status) {
            status.clientCount = (status.clientCount || 0) + 1;
            this.statusCache.set(cameraId, status);
        }
        stream.on('error', (error) => {
            logger_1.logger.error(`Camera stream error for ${cameraId}:`, error);
            this.updateCameraStatus(cameraId, 'error', error.message);
            this.activeStreams.delete(cameraId);
            this.emit('camera:error', { cameraId, error });
        });
        stream.on('close', () => {
            logger_1.logger.info(`Camera stream closed for: ${cameraId}`);
            this.activeStreams.delete(cameraId);
            this.updateCameraStatus(cameraId, 'offline');
        });
        stream.on('connected', () => {
            logger_1.logger.info(`Camera stream connected for: ${cameraId}`);
            this.updateCameraStatus(cameraId, 'online');
        });
        return stream;
    }
    async getSnapshot(cameraId) {
        const cacheKey = `snapshot_${cameraId}`;
        const cached = this.snapshotCache.get(cacheKey);
        if (cached) {
            logger_1.logger.debug(`Returning cached snapshot for: ${cameraId}`);
            return cached;
        }
        const camera = this.cameras.get(cameraId);
        if (!camera) {
            throw new Error(`Camera not found: ${cameraId}`);
        }
        const url = camera.snapshotUrl || camera.streamUrl;
        try {
            logger_1.logger.debug(`Fetching snapshot from: ${url}`);
            const auth = camera.username ? {
                auth: {
                    username: camera.username,
                    password: camera.password || ''
                }
            } : {};
            const response = await axios_1.default.get(url, {
                ...auth,
                responseType: 'arraybuffer',
                timeout: camera.timeout || 5000,
                headers: {
                    'User-Agent': 'BranaCamera/1.0'
                }
            });
            const buffer = Buffer.from(response.data);
            this.snapshotCache.set(cacheKey, buffer);
            this.updateCameraStatus(cameraId, 'online');
            logger_1.logger.debug(`Snapshot fetched successfully: ${buffer.length} bytes`);
            return buffer;
        }
        catch (error) {
            logger_1.logger.error(`Failed to get snapshot for ${cameraId}:`, error?.message || error);
            this.updateCameraStatus(cameraId, 'error', error?.message || 'Unknown error');
            throw new Error(`Failed to get snapshot: ${error?.message || 'Unknown error'}`);
        }
    }
    updateCameraStatus(cameraId, status, error) {
        const currentStatus = this.statusCache.get(cameraId);
        const updatedStatus = {
            ...currentStatus,
            id: cameraId,
            status,
            lastSeen: new Date(),
            error: error || undefined
        };
        this.statusCache.set(cameraId, updatedStatus);
        this.emit('camera:status', updatedStatus);
    }
    getCameraStatus(cameraId) {
        return this.statusCache.get(cameraId) || null;
    }
    getAllCameras() {
        return Array.from(this.cameras.values());
    }
    getAllStatuses() {
        return Array.from(this.statusCache.values());
    }
    removeCamera(cameraId) {
        const stream = this.activeStreams.get(cameraId);
        if (stream) {
            stream.close();
            this.activeStreams.delete(cameraId);
        }
        this.statusCache.delete(cameraId);
        const removed = this.cameras.delete(cameraId);
        if (removed) {
            logger_1.logger.info(`Camera removed: ${cameraId}`);
            this.emit('camera:removed', cameraId);
        }
        return removed;
    }
    async cleanup() {
        logger_1.logger.info('Cleaning up camera service...');
        for (const [cameraId, stream] of this.activeStreams) {
            logger_1.logger.debug(`Closing stream for camera: ${cameraId}`);
            stream.close();
        }
        this.activeStreams.clear();
        this.statusCache.clear();
        this.snapshotCache.flushAll();
        logger_1.logger.info('Camera service cleanup complete');
    }
}
exports.CameraService = CameraService;
//# sourceMappingURL=CameraService.js.map