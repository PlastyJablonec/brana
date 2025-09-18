"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cameraRouter = void 0;
const express_1 = require("express");
const uuid_1 = require("uuid");
const CameraService_1 = require("../modules/camera/CameraService");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
exports.cameraRouter = router;
const cameraService = new CameraService_1.CameraService();
router.get('/status', (req, res) => {
    try {
        const statuses = cameraService.getAllStatuses();
        return res.json({
            success: true,
            cameras: statuses
        });
    }
    catch (error) {
        logger_1.logger.error('Error getting camera statuses:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get camera statuses'
        });
    }
});
router.get('/list', (req, res) => {
    try {
        const cameras = cameraService.getAllCameras();
        return res.json({
            success: true,
            cameras
        });
    }
    catch (error) {
        logger_1.logger.error('Error getting cameras:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get cameras'
        });
    }
});
router.get('/:id/status', (req, res) => {
    try {
        const { id } = req.params;
        const status = cameraService.getCameraStatus(id);
        if (!status) {
            return res.status(404).json({
                success: false,
                error: `Camera not found: ${id}`
            });
        }
        return res.json({
            success: true,
            status
        });
    }
    catch (error) {
        logger_1.logger.error(`Error getting camera status for ${req.params.id}:`, error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get camera status'
        });
    }
});
router.get('/:id/snapshot', async (req, res) => {
    try {
        const { id } = req.params;
        logger_1.logger.debug(`Snapshot request for camera: ${id}`);
        const imageBuffer = await cameraService.getSnapshot(id);
        res.set({
            'Content-Type': 'image/jpeg',
            'Content-Length': imageBuffer.length.toString(),
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        res.send(imageBuffer);
        logger_1.logger.debug(`Snapshot delivered for camera ${id}: ${imageBuffer.length} bytes`);
    }
    catch (error) {
        logger_1.logger.error(`Error getting snapshot for camera ${req.params.id}:`, error);
        res.status(500).json({
            success: false,
            error: `Failed to get snapshot: ${error?.message || 'Unknown error'}`
        });
    }
});
router.get('/:id/stream', (req, res) => {
    try {
        const { id } = req.params;
        const clientId = (0, uuid_1.v4)();
        logger_1.logger.info(`MJPEG stream request for camera ${id}, client: ${clientId}`);
        const stream = cameraService.createMjpegStream(id);
        stream.addClient(clientId, res);
        req.on('close', () => {
            logger_1.logger.debug(`Client ${clientId} closed connection to camera ${id}`);
            stream.removeClient(clientId);
        });
        req.on('aborted', () => {
            logger_1.logger.debug(`Client ${clientId} aborted connection to camera ${id}`);
            stream.removeClient(clientId);
        });
        stream.start().catch(error => {
            logger_1.logger.error(`Failed to start stream for camera ${id}:`, error);
            res.status(500).json({
                success: false,
                error: `Failed to start camera stream: ${error.message}`
            });
        });
    }
    catch (error) {
        logger_1.logger.error(`Error creating stream for camera ${req.params.id}:`, error);
        res.status(500).json({
            success: false,
            error: `Failed to create camera stream: ${error?.message || 'Unknown error'}`
        });
    }
});
router.post('/', async (req, res) => {
    try {
        const config = req.body;
        if (!config.id || !config.name || !config.streamUrl) {
            res.status(400).json({
                success: false,
                error: 'Missing required fields: id, name, streamUrl'
            });
            return;
        }
        await cameraService.addCamera(config);
        res.status(201).json({
            success: true,
            message: `Camera ${config.id} added successfully`
        });
    }
    catch (error) {
        logger_1.logger.error('Error adding camera:', error);
        res.status(500).json({
            success: false,
            error: `Failed to add camera: ${error?.message || 'Unknown error'}`
        });
    }
});
router.delete('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const removed = cameraService.removeCamera(id);
        if (!removed) {
            res.status(404).json({
                success: false,
                error: `Camera not found: ${id}`
            });
            return;
        }
        res.json({
            success: true,
            message: `Camera ${id} removed successfully`
        });
    }
    catch (error) {
        logger_1.logger.error(`Error removing camera ${req.params.id}:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to remove camera'
        });
    }
});
process.on('SIGINT', async () => {
    logger_1.logger.info('Received SIGINT, cleaning up camera service...');
    await cameraService.cleanup();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    logger_1.logger.info('Received SIGTERM, cleaning up camera service...');
    await cameraService.cleanup();
    process.exit(0);
});
//# sourceMappingURL=camera.js.map