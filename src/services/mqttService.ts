import mqtt, { MqttClient, IClientOptions, IConnackPacket } from 'mqtt';
import { db } from '../firebase/config';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { httpMqttService } from './httpMqttService';

export type GateStatusType = 'Brána zavřena' | 'Brána otevřena' | 'Otevírá se...' | 'Zavírá se...' | 'Zastavena' | 'STOP režim' | 'Neznámý stav';
export type GarageStatusType = 'Garáž zavřena' | 'Garáž otevřena' | 'Garáž - otevírá se...' | 'Garáž - zavírá se...' | 'Neznámý stav';

export interface IMqttStatus {
  gateStatus: GateStatusType;
  garageStatus: GarageStatusType;
  isConnected: boolean;
}

export interface IMqttConnectionOptions extends IClientOptions {
  clientId: string;
  clean: boolean;
  reconnectPeriod: number;
  connectTimeout: number;
  keepalive: number;
  resubscribe: boolean;
  queueQoSZero: boolean;
  will: {
    topic: string;
    payload: string;
    qos: 0 | 1 | 2;
    retain: boolean;
  };
}

export interface IActivityLog {
  user: string;
  action: string;
  command: string;
  timestamp: Timestamp;
  status: 'sent' | 'failed';
}

export interface IGateLogEntry {
  id: string;
  timestamp: Date;
  source: 'app' | 'external'; // app = z aplikace, external = jiné ovládání
}

type StatusCallback = (status: IMqttStatus) => void;
type GateLogCallback = (logEntry: IGateLogEntry) => void;
type UnsubscribeFunction = () => void;


export class MqttService {
  private client: MqttClient | null = null;
  private statusCallbacks: StatusCallback[] = [];
  private connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' = 'disconnected';
  private reconnectTimer: NodeJS.Timeout | null = null;

  // Detekce zda jsme na lokální síti a výběr optimální MQTT URL
  private static getOptimalMqttUrl(): string {
    if (typeof window === 'undefined') {
      return 'ws://89.24.76.191:9001/mqtt'; // Fallback pro SSR
    }
    
    const hostname = window.location.hostname;
    console.log('🔍 MQTT Service: Detecting network for hostname:', hostname);
    
    // OPRAVA: Pro development na localhost VŽDY použít externí IP
    // Lokální broker 172.19.3.200 neexistuje!
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1'
    ) {
      console.log('🏠 MQTT Service: Localhost detected, using EXTERNAL MQTT broker (local broker not available)');
      return 'ws://89.24.76.191:9001/mqtt';
    }
    
    // Pro skutečně lokální síť (192.168.x.x, 10.x.x.x)
    if (
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.19.') // Konkrétně naše síť 172.19.3.x
    ) {
      console.log('🏠 MQTT Service: Local network detected, checking if local broker exists...');
      // TODO: V budoucnu ověřit dostupnost lokálního brokeru
      console.log('🌐 MQTT Service: Using external broker as fallback');
      return 'ws://89.24.76.191:9001/mqtt';
    }
    
    // Jinak externí IP
    console.log('🌐 MQTT Service: External network, using external MQTT broker');
    return 'ws://89.24.76.191:9001/mqtt';
  }
  private gateLogCallbacks: GateLogCallback[] = [];
  private currentStatus: IMqttStatus = {
    gateStatus: 'Neznámý stav',
    garageStatus: 'Garáž zavřena', // OPRAVA: Výchozí stav místo "Neznámý stav"
    isConnected: false
  };

  private static getMqttOverrideFromQuery(): string | null {
    try {
      if (typeof window === 'undefined') return null;
      const params = new URLSearchParams(window.location.search);
      const url = params.get('mqtt');
      if (url && (url.startsWith('ws://') || url.startsWith('wss://'))) return url;
    } catch {}
    return null;
  }

  private static getMqttOverrideFromStorage(): string | null {
    try {
      if (typeof window === 'undefined') return null;
      const url = localStorage.getItem('MQTT_URL') || localStorage.getItem('mqtt_url');
      if (url && (url.startsWith('ws://') || url.startsWith('wss://'))) return url;
    } catch {}
    return null;
  }

  constructor(
    private readonly brokerUrl: string = (() => {
      // STRICT env-based configuration without any runtime overrides
      const isHttps = (typeof window !== 'undefined' && window.location.protocol === 'https:');
      const wssUrl = process.env.REACT_APP_MQTT_WSS_URL;
      const wsUrl = process.env.REACT_APP_MQTT_URL;
      
      if (isHttps) {
        if (!wssUrl) {
          console.warn('⚠️ REACT_APP_MQTT_WSS_URL není nastaveno, používám výchozí WSS URL');
          const fallbackWssUrl = 'wss://89.24.76.191:9002/mqtt';
          console.log('🔧 MQTT CONFIG (HTTPS fallback):', fallbackWssUrl);
          return fallbackWssUrl;
        }
        console.log('🔧 MQTT CONFIG (HTTPS): REACT_APP_MQTT_WSS_URL =', wssUrl);
        return wssUrl;
      } else {
        if (!wsUrl) {
          console.warn('⚠️ REACT_APP_MQTT_URL není nastaveno, používám výchozí WS URL');
          const fallbackWsUrl = 'ws://89.24.76.191:9001/mqtt';
          console.log('🔧 MQTT CONFIG (HTTP fallback):', fallbackWsUrl);
          return fallbackWsUrl;
        }
        console.log('🔧 MQTT CONFIG (HTTP): REACT_APP_MQTT_URL =', wsUrl);
        return wsUrl;
      }
    })(),
    private readonly options: IMqttConnectionOptions = {
      clientId: `gate-control-${Math.random().toString(16).substring(2, 8)}`,
      clean: true,
      reconnectPeriod: 5000,
      connectTimeout: 15000,
      keepalive: 60,
      resubscribe: true,
      queueQoSZero: true,
      will: {
        topic: 'Log/Brana/Disconnect',
        payload: 'Client disconnected',
        qos: 1,
        retain: false
      }
    }
  ) {
    console.log('🔧 MQTT Service: Constructor initialized with connection state:', this.connectionState);
  }

  public async connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        // 🔐 SINGLETON PATTERN: Prevence duplicitních připojení
        if (this.connectionState === 'connected') {
          console.log('✅ MQTT already connected, reusing existing connection');
          resolve();
          return;
        }

        if (this.connectionState === 'connecting') {
          console.log('⏳ MQTT connection already in progress, waiting...');
          // Počkaj max 10 sekund na dokončení existujícího připojení
          const connectionTimeout = setTimeout(() => {
            if (this.connectionState !== 'connected') {
              console.warn('⚠️ MQTT connection timeout, forcing retry...');
              this.connectionState = 'disconnected';
              this.connect().then(resolve).catch(reject);
            }
          }, 10000);

          // Monitoruj state změny
          const checkConnection = () => {
            if (this.connectionState === 'connected') {
              clearTimeout(connectionTimeout);
              resolve();
            } else if (this.connectionState === 'disconnected') {
              clearTimeout(connectionTimeout);
              reject(new Error('Connection failed during wait'));
            } else {
              // Pokračuj v čekání
              setTimeout(checkConnection, 100);
            }
          };
          checkConnection();
          return;
        }

        // Nastav state jako "connecting"
        this.connectionState = 'connecting';
        console.log(`🔌 MQTT Service: Starting connection to ${this.brokerUrl}`);

        // Disconnect any existing connection first
        if (this.client) {
          console.log('🔄 MQTT Service: Cleaning up existing connection');
          this.client.removeAllListeners();
          this.client.end(true);
          this.client = null;
        }

        // 🌍 SMART CONNECTION STRATEGY: HTTP proxy first, direct WebSocket as fallback
        const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';

        if (isHttps) {
          console.log('🌐 HTTPS detected: Using HTTP MQTT proxy...');
          this.connectViaHttpProxy(resolve, reject);
        } else {
          console.log('🔧 HTTP detected: Using direct WebSocket connection...');
          this.connectDirectWebSocket(this.brokerUrl.replace('wss://', 'ws://'), resolve, reject);
        }

      } catch (error) {
        this.connectionState = 'disconnected';
        const mqttError = error instanceof Error ? error : new Error('Unknown MQTT setup error');
        console.error('❌ MQTT Setup Error:', mqttError);
        reject(mqttError);
      }
    });
  }

  private async connectViaHttpProxy(resolve: () => void, reject: (error: any) => void): Promise<void> {
    try {
      console.log('🌐 Connecting via HTTP MQTT proxy...');

      await httpMqttService.connect();

      console.log('✅ HTTP MQTT proxy connected successfully');
      this.connectionState = 'connected';
      this.currentStatus.isConnected = true;
      this.notifyStatusChange();

      // Forward HTTP MQTT callbacks
      httpMqttService.onStatusChange((status) => {
        console.log('🔄 MQTT Service: Status from HTTP proxy:', status);
        this.currentStatus = { ...status };
        this.notifyStatusChange();
      });

      httpMqttService.onGateLogChange((logEntry) => {
        console.log('🔄 MQTT Service: Gate log from HTTP proxy:', logEntry);
        this.notifyGateLogChange(logEntry);
      });

      // Get initial status
      const initialStatus = httpMqttService.getStatus();
      if (initialStatus.gateStatus !== 'Neznámý stav') {
        this.currentStatus = { ...initialStatus };
        this.notifyStatusChange();
      }

      resolve();

    } catch (error) {
      console.error('❌ HTTP MQTT proxy failed:', error);
      console.log('🔄 Fallback: Trying direct WSS connection using configured REACT_APP_MQTT_WSS_URL...');

      try {
        const wssUrl = process.env.REACT_APP_MQTT_WSS_URL;
        if (!wssUrl) {
          throw new Error('REACT_APP_MQTT_WSS_URL is not configured');
        }
        this.connectDirectWebSocket(wssUrl, resolve, reject);
      } catch (fallbackError) {
        console.error('❌ Direct WSS fallback also failed:', fallbackError);
        this.connectionState = 'disconnected';
        this.currentStatus.isConnected = false;
        this.notifyStatusChange();
        reject(new Error(`Both HTTP proxy and WSS failed: ${error}, ${fallbackError}`));
      }
    }
  }

  private async subscribeToTopics(): Promise<void> {
    if (!this.client) {
      throw new Error('MQTT client not available for subscription');
    }

    const subscriptions = [
      { topic: 'IoT/Brana/Status', name: 'gate status' },
      { topic: 'IoT/Brana/Status2', name: 'garage status' },
      { topic: 'Log/Brana/ID', name: 'gate activity log' }
    ];
    
    console.log('📋 MQTT Service: Attempting to subscribe to topics:', subscriptions.map(s => s.topic));

    // Subscribe jeden po druhém místo Promise.all - uvidíme který failuje
    for (const { topic, name } of subscriptions) {
      try {
        console.log(`🔄 Attempting to subscribe to ${topic} (${name})...`);
        
        await new Promise<void>((resolve, reject) => {
          this.client!.subscribe(topic, { qos: 0 }, (err) => {
            if (err) {
              console.error(`❌ FAILED to subscribe to ${name} (${topic}):`, err);
              reject(new Error(`Failed to subscribe to ${topic}: ${err.message}`));
            } else {
              console.log(`✅ SUCCESS: Subscribed to ${topic} (${name})`);
              resolve();
            }
          });
        });
        
        console.log(`🎯 ${topic} subscription completed successfully`);
        
      } catch (error) {
        console.error(`💥 SUBSCRIPTION ERROR for ${topic}:`, error);
        throw error; // Stop the whole process to see which one fails
      }
    }
    
    // 🧪 EXPERIMENT: Simple HTML approach + Smart Trigger
    console.log('🧪 Using simple HTML approach - no status requests, waiting for automatic messages...');
    console.log('📡 Subscribed to topics, waiting for hardware to send status automatically...');
    
    // 💡 Hardware posílá jen P1 status, ostatní stavy řídí timer
    console.log('📡 Garage: Waiting for P1 messages only - no status requests needed');
  }

  public disconnect(): void {
    console.log('🔌 MQTT Service: Starting disconnect process...');

    // Clear reconnect timer if exists
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Reset connection state immediately
    this.connectionState = 'disconnected';
    this.currentStatus.isConnected = false;

    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';

    if (isHttps) {
      console.log('🔌 Disconnecting HTTP MQTT proxy...');
      httpMqttService.disconnect();
    }

    if (this.client) {
      console.log('🔌 Disconnecting direct MQTT client...');

      // Remove all event listeners to prevent memory leaks
      this.client.removeAllListeners();

      // Force close the connection immediately
      this.client.end(true);
      this.client = null;
    }

    this.notifyStatusChange();
    console.log('✅ MQTT Service: Disconnect completed');
  }

  private handleMessage(topic: string, message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`📨 [${timestamp}] MQTT Message: ${topic} = ${message}`);
    
    switch (topic) {
      case 'IoT/Brana/Status':
        const oldGateStatus = this.currentStatus.gateStatus;
        this.currentStatus.gateStatus = this.parseGateStatus(message);
        console.log(`🚪 Gate status: ${oldGateStatus} → ${this.currentStatus.gateStatus}`);
        break;
      case 'IoT/Brana/Status2':
        const oldGarageStatus = this.currentStatus.garageStatus;
        this.currentStatus.garageStatus = this.parseGarageStatus(message);
        console.log(`🏠 Garage status: ${oldGarageStatus} → ${this.currentStatus.garageStatus}`);
        break;
      case 'Log/Brana/ID':
        // Zpracování external gate activity log
        this.handleGateLogMessage(message);
        break;
    }
    
    this.notifyStatusChange();
  }

  private parseGateStatus(status: string): GateStatusType {
    // Parse gate status - support both codes (P1) and text ("Brána zavřena")
    const cleanStatus = status.trim();
    
    // First try direct text match (what MQTT broker actually sends)
    if (cleanStatus === 'Brána zavřena') return 'Brána zavřena';
    if (cleanStatus === 'Brána otevřena') return 'Brána otevřena';
    if (cleanStatus === 'Otevírá se...') return 'Otevírá se...';
    if (cleanStatus === 'Zavírá se...') return 'Zavírá se...';
    if (cleanStatus === 'Zastavena') return 'Zastavena';
    if (cleanStatus === 'STOP režim') return 'STOP režim';
    
    // Fallback to original codes (P1, P2, etc.)
    const upperStatus = cleanStatus.toUpperCase();
    switch (upperStatus) {
      case 'P1':
        return 'Brána zavřena';
      case 'P2':
        return 'Brána otevřena';
      case 'P3':
        return 'Otevírá se...';
      case 'P4':
        return 'Zavírá se...';
      case 'P5':
        return 'Zastavena';
      case 'P6':
        return 'STOP režim';
      default:
        console.warn(`Unknown gate status received: "${status}" - will show as Neznámý stav`);
        return 'Neznámý stav';
    }
  }

  private parseGarageStatus(status: string): GarageStatusType {
    // Hardware posílá P1 = zavřeno a "pohyb" zprávy
    const upperStatus = status.toUpperCase();
    
    // P1 = definitively closed (overrides timer)
    if (upperStatus === 'P1') {
      return 'Garáž zavřena';
    }
    
    // Movement message = hardware is moving (but we ignore this, timer controls state)
    if (upperStatus.includes('POHYB') || upperStatus.includes('POHYBU')) {
      console.log(`MQTT: Hardware movement message received: ${status} - ignoring, timer controls state`);
      return 'Neznámý stav'; // Don't override timer state
    }
    
    console.warn(`Unknown garage status received: ${status} - expected P1 or pohyb message`);
    return 'Neznámý stav';
  }

  public async publishGateCommand(userEmail: string): Promise<void> {
    console.log('📡 publishGateCommand called for:', userEmail);
    console.log('🔌 MQTT client exists:', !!this.client);
    console.log('🔌 MQTT connected status:', this.currentStatus.isConnected);
    
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    
    if (isHttps) {
      console.log('🌐 Using HTTP MQTT proxy for gate command');
      await httpMqttService.publishGateCommand(userEmail);
      return;
    }
    
    this.validateConnection();
    const command = '1';
    console.log('📤 Publishing gate command:', command, 'for', userEmail);
    await this.publishCommand(command, userEmail, 'Brána');
  }

  public async publishGarageCommand(userEmail: string): Promise<void> {
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    
    if (isHttps) {
      console.log('🌐 Using HTTP MQTT proxy for garage command');
      await httpMqttService.publishGarageCommand(userEmail);
      return;
    }
    
    this.validateConnection();
    const command = '3';
    await this.publishCommand(command, userEmail, 'Garáž');
  }

  public async publishStopCommand(userEmail: string): Promise<void> {
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    
    if (isHttps) {
      console.log('🌐 Using HTTP MQTT proxy for stop command');
      await httpMqttService.publishStopCommand(userEmail);
      return;
    }
    
    this.validateConnection();
    const command = '6';
    await this.publishCommand(command, userEmail, 'STOP režim');
  }

  private validateConnection(): void {
    if (!this.client || !this.currentStatus.isConnected) {
      const error = `MQTT not connected - client: ${!!this.client}, connected: ${this.currentStatus.isConnected}`;
      console.error('❌', error);
      throw new Error(error);
    }
  }

  private async publishCommand(command: string, userEmail: string, action: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.client) {
        const error = new Error('MQTT client not available');
        console.error('❌', error.message);
        reject(error);
        return;
      }

      this.client.publish('IoT/Brana/Ovladani', command, { qos: 0 }, (publishError) => {  // ⚡ QoS 0 pro rychlost
        if (publishError) {
          console.error('❌ MQTT Publish error:', publishError);
          reject(publishError);
        } else {
          console.log(`✅ MQTT Command sent: ${command} by ${userEmail}`);
          
          // Note: Activity logging is now handled in Dashboard.tsx with detailed actions
          // This old logging system created generic "Brána"/"Garáž" entries
          resolve();
        }
      });
    });
  }

  private async logActivityToFirestore(userEmail: string, action: string, command: string): Promise<void> {
    try {
      const activityLog: IActivityLog = {
        user: userEmail,
        action: action,
        command: command,
        timestamp: Timestamp.now(),
        status: 'sent'
      };

      await addDoc(collection(db, 'activity_logs'), activityLog);
    } catch (error) {
      const firestoreError = error instanceof Error ? error : new Error('Unknown Firestore error');
      console.error('❌ Failed to log activity to Firestore:', firestoreError);
      throw firestoreError;
    }
  }

  public async publishMessage(topic: string, message: string): Promise<void> {
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    
    if (isHttps) {
      console.log('🌐 Using HTTP MQTT proxy for publishMessage');
      await httpMqttService.publishMessage(topic, message);
      return;
    }
    
    return new Promise<void>((resolve, reject) => {
      if (!this.client) {
        const error = new Error('MQTT client not available');
        console.error('❌', error.message);
        reject(error);
        return;
      }

      this.client.publish(topic, message, { qos: 0 }, (publishError) => {  // ⚡ QoS 0 pro rychlost
        if (publishError) {
          console.error('❌ MQTT Publish error:', publishError);
          reject(publishError);
        } else {
          console.log(`✅ MQTT Message sent to ${topic}: ${message}`);
          resolve();
        }
      });
    });
  }

  private handleGateLogMessage(message: string): void {
    console.log(`🎯 MQTT Service: Log/Brana/ID message received: "${message}"`);
    console.log(`📋 Gate Log: External activity detected - ID: ${message}`);
    
    const logEntry: IGateLogEntry = {
      id: message.trim(),
      timestamp: new Date(),
      source: 'external'
    };
    
    console.log('🔔 MQTT Service: Notifying gate log callbacks with:', logEntry);
    // Notify all gate log callbacks
    this.notifyGateLogChange(logEntry);
  }

  private notifyGateLogChange(logEntry: IGateLogEntry): void {
    console.log('🔧 MQTT Service: Notifying gate log change to', this.gateLogCallbacks.length, 'callbacks');
    
    this.gateLogCallbacks.forEach((callback, index) => {
      try {
        console.log(`🔧 MQTT Service: Calling gate log callback ${index}...`);
        callback(logEntry);
      } catch (error) {
        console.error(`❌ MQTT Service: Error in gate log callback ${index}:`, error);
      }
    });
  }

  public onGateLogChange(callback: GateLogCallback): UnsubscribeFunction {
    this.gateLogCallbacks.push(callback);
    
    // Return unsubscribe function
    return (): void => {
      this.gateLogCallbacks = this.gateLogCallbacks.filter(cb => cb !== callback);
    };
  }

  public onStatusChange(callback: StatusCallback): UnsubscribeFunction {
    this.statusCallbacks.push(callback);
    
    // Return unsubscribe function
    return (): void => {
      this.statusCallbacks = this.statusCallbacks.filter(cb => cb !== callback);
    };
  }

  private notifyStatusChange(): void {
    console.log('🔧 MQTT Service: Notifying status change to', this.statusCallbacks.length, 'callbacks');
    console.log('🔧 MQTT Service: Current status:', this.currentStatus);
    
    this.statusCallbacks.forEach((callback, index) => {
      try {
        console.log(`🔧 MQTT Service: Calling callback ${index}...`);
        callback({...this.currentStatus}); // Send a copy to prevent mutations
        console.log(`🔧 MQTT Service: Callback ${index} completed`);
      } catch (error) {
        console.error(`Error in status callback ${index}:`, error);
      }
    });
  }

  public getStatus(): IMqttStatus {
    return { ...this.currentStatus };
  }

  public isConnected(): boolean {
    return this.currentStatus.isConnected;
  }

  // Direct WebSocket connection with proper state management
  private connectDirectWebSocket(url: string, resolve: () => void, reject: (error: any) => void): void {
    console.log(`🔄 MQTT Service: Direct WebSocket connection to ${url}`);

    if (!mqtt || typeof mqtt.connect !== 'function') {
      this.connectionState = 'disconnected';
      reject(new Error('MQTT library not available for direct connection'));
      return;
    }

    try {
      // Ensure URL contains /mqtt path (common for WS brokers)
      let wsUrl = url;
      try {
        const u = new URL(url, typeof window !== 'undefined' ? window.location.href : undefined);
        if (!u.pathname || u.pathname === '/') {
          u.pathname = '/mqtt';
        }
        wsUrl = u.toString();
      } catch {
        // keep original if URL parsing fails
      }

      // Force protocolVersion 4 (MQTT 3.1.1) for broader broker compatibility
      this.client = mqtt.connect(wsUrl, {
        ...this.options,
        protocolVersion: 4,
        clientId: `gate-control-direct-${Math.random().toString(16).substring(2, 8)}`
      });

      this.client.on('connect', async (connack: IConnackPacket) => {
        console.log('✅ Direct WebSocket MQTT connection established', connack);
        this.connectionState = 'connected';
        this.currentStatus.isConnected = true;
        this.notifyStatusChange();

        try {
          await this.subscribeToTopics();
          console.log('✅ Direct WebSocket: All subscriptions completed');
          resolve();
        } catch (subscribeError) {
          console.error('❌ Direct WebSocket: Subscription failed:', subscribeError);
          this.connectionState = 'disconnected';
          this.currentStatus.isConnected = false;
          this.notifyStatusChange();
          reject(subscribeError);
        }
      });

      this.client.on('message', (topic: string, message: Buffer, packet: any) => {
        const messageStr = message.toString();
        const isRetained = packet?.retain || false;
        console.log(`📨 Direct WS MQTT: ${topic} = ${messageStr} ${isRetained ? '(RETAINED)' : '(LIVE)'}`);
        this.handleMessage(topic, messageStr);
      });

      this.client.on('error', (error: Error) => {
        console.error('❌ Direct WebSocket MQTT error:', error);
        this.connectionState = 'disconnected';
        this.currentStatus.isConnected = false;
        this.notifyStatusChange();
        reject(error);
      });

      this.client.on('close', () => {
        console.log('🔌 Direct WebSocket MQTT connection closed');
        this.connectionState = 'disconnected';
        this.currentStatus.isConnected = false;
        this.notifyStatusChange();
      });

      this.client.on('reconnect', () => {
        console.log('🔄 Direct WebSocket MQTT reconnecting...');
        this.connectionState = 'reconnecting';
      });

      this.client.on('offline', () => {
        console.log('📴 Direct WebSocket MQTT client offline');
        this.connectionState = 'disconnected';
        this.currentStatus.isConnected = false;
        this.notifyStatusChange();
      });

      this.client.on('end', () => {
        console.log('🛑 Direct WebSocket MQTT connection ended');
        this.connectionState = 'disconnected';
        this.currentStatus.isConnected = false;
        this.notifyStatusChange();
      });

    } catch (error) {
      console.error('❌ Direct WebSocket connection setup failed:', error);
      this.connectionState = 'disconnected';
      reject(error);
    }
  }

}

// Export singleton instance
export const mqttService = new MqttService();
