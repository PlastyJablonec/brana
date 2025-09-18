import { EventEmitter } from 'events';
import { CameraConfig } from './types';
export declare class CameraStream extends EventEmitter {
    private config;
    private clients;
    private connectionAttempts;
    private isConnected;
    private reconnectTimer?;
    private streamBuffer;
    private boundary;
    private sourceStream?;
    constructor(config: CameraConfig);
    start(): Promise<void>;
    private connectToCamera;
    private setupStreamHandlers;
    private handleStreamData;
    private processStreamBuffer;
    private broadcastToClients;
    private handleStreamError;
    private handleStreamEnd;
    private scheduleReconnect;
    addClient(clientId: string, response: any): void;
    removeClient(clientId: string): void;
    getClientCount(): number;
    getStatus(): {
        connected: boolean;
        clientCount: number;
        connectionAttempts: number;
    };
    close(): void;
}
//# sourceMappingURL=CameraStream.d.ts.map