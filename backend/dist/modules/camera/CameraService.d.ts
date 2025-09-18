import { EventEmitter } from 'events';
import { CameraConfig, CameraStatus } from './types';
import { CameraStream } from './CameraStream';
export declare class CameraService extends EventEmitter {
    private cameras;
    private activeStreams;
    private snapshotCache;
    private statusCache;
    constructor();
    private initializeDefaultCamera;
    addCamera(config: CameraConfig): Promise<void>;
    private validateCamera;
    createMjpegStream(cameraId: string): CameraStream;
    getSnapshot(cameraId: string): Promise<Buffer>;
    private updateCameraStatus;
    getCameraStatus(cameraId: string): CameraStatus | null;
    getAllCameras(): CameraConfig[];
    getAllStatuses(): CameraStatus[];
    removeCamera(cameraId: string): boolean;
    cleanup(): Promise<void>;
}
//# sourceMappingURL=CameraService.d.ts.map