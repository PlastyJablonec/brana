import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { CameraService } from '../modules/camera/CameraService';
import { logger } from '../utils/logger';

const router = Router();

// Singleton camera service instance
const cameraService = new CameraService();

// GET /api/camera/status - získat status všech kamer
router.get('/status', (req: Request, res: Response) => {
  try {
    const statuses = cameraService.getAllStatuses();
    return res.json({
      success: true,
      cameras: statuses
    });
  } catch (error) {
    logger.error('Error getting camera statuses:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get camera statuses'
    });
  }
});

// GET /api/camera/list - získat všechny kamery
router.get('/list', (req: Request, res: Response) => {
  try {
    const cameras = cameraService.getAllCameras();
    return res.json({
      success: true,
      cameras
    });
  } catch (error) {
    logger.error('Error getting cameras:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get cameras'
    });
  }
});

// GET /api/camera/:id/status - status konkrétní kamery
router.get('/:id/status', (req: Request, res: Response) => {
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
  } catch (error) {
    logger.error(`Error getting camera status for ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get camera status'
    });
  }
});

// GET /api/camera/:id/snapshot - jednorázový snapshot
router.get('/:id/snapshot', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    logger.debug(`Snapshot request for camera: ${id}`);
    
    const imageBuffer = await cameraService.getSnapshot(id);
    
    res.set({
      'Content-Type': 'image/jpeg',
      'Content-Length': imageBuffer.length.toString(),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    res.send(imageBuffer);
    logger.debug(`Snapshot delivered for camera ${id}: ${imageBuffer.length} bytes`);
    
  } catch (error: any) {
    logger.error(`Error getting snapshot for camera ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: `Failed to get snapshot: ${error?.message || 'Unknown error'}`
    });
  }
});

// GET /api/camera/:id/stream - MJPEG video stream
router.get('/:id/stream', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const clientId = uuidv4();
    
    logger.info(`MJPEG stream request for camera ${id}, client: ${clientId}`);
    
    // Vytvoř nebo získej existující stream
    const stream = cameraService.createMjpegStream(id);
    
    // Připoj klienta ke streamu
    stream.addClient(clientId, res);
    
    // Cleanup když klient zavře spojení
    req.on('close', () => {
      logger.debug(`Client ${clientId} closed connection to camera ${id}`);
      stream.removeClient(clientId);
    });
    
    req.on('aborted', () => {
      logger.debug(`Client ${clientId} aborted connection to camera ${id}`);
      stream.removeClient(clientId);
    });
    
    // Spusť stream pokud ještě není aktivní
    stream.start().catch(error => {
      logger.error(`Failed to start stream for camera ${id}:`, error);
      res.status(500).json({
        success: false,
        error: `Failed to start camera stream: ${error.message}`
      });
    });
    
  } catch (error: any) {
    logger.error(`Error creating stream for camera ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: `Failed to create camera stream: ${error?.message || 'Unknown error'}`
    });
  }
});

// POST /api/camera - přidat novou kameru
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const config = req.body;
    
    // Validace základních polí
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
    
  } catch (error: any) {
    logger.error('Error adding camera:', error);
    res.status(500).json({
      success: false,
      error: `Failed to add camera: ${error?.message || 'Unknown error'}`
    });
  }
});

// DELETE /api/camera/:id - odstranit kameru
router.delete('/:id', (req: Request, res: Response): void => {
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
    
  } catch (error) {
    logger.error(`Error removing camera ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove camera'
    });
  }
});

// Graceful cleanup při ukončení procesu
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, cleaning up camera service...');
  await cameraService.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, cleaning up camera service...');
  await cameraService.cleanup();
  process.exit(0);
});

export { router as cameraRouter };