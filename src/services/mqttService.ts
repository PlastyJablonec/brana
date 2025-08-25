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

// 🔐 Globální singleton ochrana proti hot reloading
declare global {
  interface Window {
    __MQTT_SERVICE_INSTANCES__: MqttService[];
    __MQTT_CLIENT_COUNT__: number;
    __GLOBAL_MQTT_CLIENT__: MqttClient | null;
  }
}

export class MqttService {
  private client: MqttClient | null = null;
  private statusCallbacks: StatusCallback[] = [];
  
  // Detekce zda jsme na lokální síti a výběr optimální MQTT URL
  private static getOptimalMqttUrl(): string {
    if (typeof window === 'undefined') {
      return 'ws://89.24.76.191:9001'; // Fallback pro SSR
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
      return 'ws://89.24.76.191:9001';
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
      return 'ws://89.24.76.191:9001';
    }
    
    // Jinak externí IP
    console.log('🌐 MQTT Service: External network, using external MQTT broker');
    return 'ws://89.24.76.191:9001';
  }
  private gateLogCallbacks: GateLogCallback[] = [];
  private currentStatus: IMqttStatus = {
    gateStatus: 'Neznámý stav',
    garageStatus: 'Neznámý stav',
    isConnected: false
  };

  constructor(
    private readonly brokerUrl: string = typeof window !== 'undefined' && window.location.protocol === 'https:' 
      ? (process.env.REACT_APP_MQTT_WSS_URL || 'wss://89.24.76.191:9002')
      : (process.env.REACT_APP_MQTT_URL || MqttService.getOptimalMqttUrl()),
    private readonly options: IMqttConnectionOptions = {
      clientId: `gate-control-${Math.random().toString(16).substring(2, 8)}`,
      clean: true,  // ⚡ TRUE pro okamžité retained messages
      reconnectPeriod: 5000,  // ⚡ Sladěno s MQTT proxy (5s místo 3s)
      connectTimeout: 15000,  // ⚡ Delší timeout pro stabilitu
      keepalive: 60,          // ⚡ Sladěno s MQTT proxy (60s místo 30s)
      resubscribe: true,
      queueQoSZero: true,     // ⚡ Optimalizace pro rychlé zprávy
      will: {
        topic: 'Log/Brana/Disconnect',
        payload: 'Client disconnected',
        qos: 1,
        retain: false
      }
    }
  ) {
    // 🔐 Globální tracking pro zabránění vícenásobných připojení
    if (typeof window !== 'undefined') {
      if (!window.__MQTT_SERVICE_INSTANCES__) {
        window.__MQTT_SERVICE_INSTANCES__ = [];
        window.__MQTT_CLIENT_COUNT__ = 0;
      }
      
      // Odpojit a vyčistit všechny staré instance při hot reload
      if (window.__MQTT_SERVICE_INSTANCES__.length > 0) {
        console.log(`🧹 Hot reload detected - cleaning up ${window.__MQTT_SERVICE_INSTANCES__.length} old MQTT instances`);
        window.__MQTT_SERVICE_INSTANCES__.forEach((oldInstance, index) => {
          console.log(`🔌 Disconnecting old instance ${index + 1}`);
          try {
            oldInstance.disconnect();
          } catch (error) {
            console.warn(`⚠️ Error disconnecting old instance ${index + 1}:`, error);
          }
        });
        window.__MQTT_SERVICE_INSTANCES__ = [];
        window.__MQTT_CLIENT_COUNT__ = 0;
      }
      
      window.__MQTT_SERVICE_INSTANCES__.push(this);
      console.log(`📊 MQTT Service constructor: Registered instance ${window.__MQTT_SERVICE_INSTANCES__.length}`);
    }
  }

  public async connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        // 🔐 Globální ochrana proti vícenásobným připojením
        if (typeof window !== 'undefined') {
          // Silná ochrana - pokud už existují připojení, vyčistit je
          if (window.__MQTT_CLIENT_COUNT__ > 0) {
            console.warn(`🚨 MQTT Service: Already have ${window.__MQTT_CLIENT_COUNT__} active connections, forcing cleanup...`);
            
            // Force cleanup všech existujících připojení
            if (window.__MQTT_SERVICE_INSTANCES__) {
              window.__MQTT_SERVICE_INSTANCES__.forEach((oldInstance, index) => {
                console.log(`🧹 Force cleanup of MQTT instance ${index + 1}`);
                try {
                  oldInstance.disconnect();
                } catch (error) {
                  console.warn(`⚠️ Error in force cleanup ${index + 1}:`, error);
                }
              });
            }
            
            // Reset counter
            window.__MQTT_CLIENT_COUNT__ = 0;
            console.log('🔄 Reset MQTT client counter to 0');
          }
          
          window.__MQTT_CLIENT_COUNT__++;
          console.log(`📊 MQTT Connect: Setting counter to ${window.__MQTT_CLIENT_COUNT__}`);
        }
        
        // Disconnect any existing connection first to prevent multiple connections
        if (this.client) {
          console.log('🔄 MQTT Service: Cleaning up existing connection before reconnect');
          this.disconnect();
        }
        
        console.log(`🔌 Connecting to MQTT broker: ${this.brokerUrl}`);
        console.log('⚙️ MQTT options:', this.options);
        
        // 🌍 OPRAVA: VŽDY používej HTTP proxy - broker odmítá vícenásobná WebSocket připojení
        // Původní problém: broker na 89.24.76.191:9001 odmítá nová připojení s "connack timeout"
        const forceHttpProxy = true; // Vynutit HTTP proxy kvůli connection limit na brokeru
        
        if (forceHttpProxy) {
          console.log('🌐 MQTT Service: Using HTTP proxy (broker connection limit protection)...');
          // Try HTTP proxy service on HTTPS
          httpMqttService.connect()
            .then(() => {
              console.log('✅ MQTT connected via HTTP proxy');
              this.currentStatus.isConnected = true;
              this.notifyStatusChange();
              
              // Forward HTTP MQTT status changes to this service
              httpMqttService.onStatusChange((status) => {
                console.log('🔄 MQTT Service: Received status from HTTP MQTT:', status);
                this.currentStatus = { ...status };
                console.log('🔄 MQTT Service: Forwarding to Dashboard callbacks...');
                this.notifyStatusChange();
              });
              
              // Forward HTTP MQTT gate log changes to this service
              httpMqttService.onGateLogChange((logEntry) => {
                console.log('🔄 MQTT Service: Forwarding gate log from HTTP proxy:', logEntry);
                this.notifyGateLogChange(logEntry);
              });
              
              // CRITICAL: Get initial status immediately after registering callbacks
              console.log('🚀 MQTT Service: Getting initial status from HTTP MQTT...');
              const initialStatus = httpMqttService.getStatus();
              console.log('🚀 MQTT Service: Initial status:', initialStatus);
              if (initialStatus.gateStatus !== 'Neznámý stav') {
                console.log('🚀 MQTT Service: Force updating with initial status');
                this.currentStatus = { ...initialStatus };
                this.notifyStatusChange();
              }
              
              resolve();
            })
            .catch((error) => {
              console.error('❌ HTTP MQTT proxy connection failed:', error);
              console.warn('🔄 MQTT Service: HTTP proxy failed, trying direct WSS connection as fallback...');
              
              // Fallback to direct WSS connection even on HTTPS
              try {
                this.connectDirectWebSocket('wss://89.24.76.191:9002', resolve, reject);
              } catch (directError) {
                console.error('❌ Direct WSS fallback also failed:', directError);
                this.currentStatus.isConnected = false;
                this.notifyStatusChange();
                reject(new Error(`Both HTTP proxy and direct WSS failed: ${error}, ${directError}`));
              }
            });
          return;
        }
        
        if (!mqtt || typeof mqtt.connect !== 'function') {
          const error = new Error('MQTT library not available - mqtt.connect is not a function');
          console.error('❌ MQTT library error:', error);
          reject(error);
          return;
        }
        
        // On HTTP, use direct WebSocket connection
        let brokerUrl = this.brokerUrl.replace('wss://', 'ws://');
        console.log('🔧 MqttService: HTTP detected, using WS:', brokerUrl);
        
        this.client = mqtt.connect(brokerUrl, this.options);
        console.log('🔗 MQTT client created:', !!this.client);
        
        // 🌍 Uložit do globálního objektu pro sdílení mezi instancemi
        if (typeof window !== 'undefined') {
          window.__GLOBAL_MQTT_CLIENT__ = this.client;
          console.log('🌍 Global MQTT client stored');
        }

        this.client.on('connect', (connack: IConnackPacket) => {
          const timestamp = new Date().toISOString();
          console.log(`✅ [${timestamp}] MQTT Connected successfully`, connack);
          console.log(`🔍 [${timestamp}] Session present: ${connack.sessionPresent}`);
          console.log(`🔍 [${timestamp}] Return code: ${connack.returnCode}`);
          this.currentStatus.isConnected = true;
          console.log('🔄 MQTT status updated:', this.currentStatus);
          this.notifyStatusChange();
          
          // Subscribe to status topics with proper error handling
          console.log('🔧 MQTT Service: Starting subscription process...');
          this.subscribeToTopics()
            .then(() => {
              console.log('✅ MQTT Service: All subscriptions completed successfully');
              resolve();
            })
            .catch(error => {
              console.error('❌ MQTT Service: Failed to subscribe to topics:', error);
              reject(error);
            });
        });

        this.client.on('message', (topic: string, message: Buffer, packet: any) => {
          const messageStr = message.toString();
          const isRetained = packet?.retain || false;
          console.log(`📨 MQTT Message: ${topic} = ${messageStr} ${isRetained ? '(RETAINED)' : '(LIVE)'}`);
          this.handleMessage(topic, messageStr);
        });

        this.client.on('error', (error: Error) => {
          console.error('❌ MQTT Connection Error:', error);
          this.currentStatus.isConnected = false;
          this.notifyStatusChange();
          
          // Check if it's a mixed content error on HTTPS
          const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
          if (isHttps && error.message.includes('insecure WebSocket')) {
            console.error('💡 Mixed content blocked - MQTT requires HTTP or manual browser permission');
            const mixedContentError = new Error('MQTT blokované kvôli mixed content policy - povoľte v prehliadači alebo použite HTTP verziu');
            reject(mixedContentError);
          } else {
            reject(error);
          }
        });

        this.client.on('close', () => {
          console.log('🔌 MQTT Disconnected - will try to reconnect...');
          this.currentStatus.isConnected = false;
          this.notifyStatusChange();
        });

        this.client.on('reconnect', () => {
          console.log('🔄 MQTT Reconnecting...');
        });
        
        this.client.on('offline', () => {
          console.log('📴 MQTT Client offline');
          this.currentStatus.isConnected = false;
          this.notifyStatusChange();
        });
        
        this.client.on('end', () => {
          console.log('🛑 MQTT Connection ended');
          this.currentStatus.isConnected = false;
          this.notifyStatusChange();
        });

      } catch (error) {
        const mqttError = error instanceof Error ? error : new Error('Unknown MQTT setup error');
        console.error('❌ MQTT Setup Error:', mqttError);
        reject(mqttError);
      }
    });
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
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    
    if (isHttps) {
      console.log('🔌 Disconnecting HTTP MQTT proxy...');
      httpMqttService.disconnect();
    } else if (this.client) {
      console.log('🔌 Disconnecting MQTT client...');
      
      // Remove all event listeners to prevent memory leaks
      this.client.removeAllListeners();
      
      // Force close the connection immediately
      this.client.end(true);
      this.client = null;
    }
    
    // 🔐 Dekrementovat globální počítač připojení
    if (typeof window !== 'undefined' && window.__MQTT_CLIENT_COUNT__ > 0) {
      window.__MQTT_CLIENT_COUNT__--;
      console.log(`📊 MQTT Disconnect: Decrementing counter to ${window.__MQTT_CLIENT_COUNT__}`);
    }
    
    this.currentStatus.isConnected = false;
    this.notifyStatusChange();
    console.log('✅ MQTT client disconnected');
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

  // Fallback method for direct WebSocket connection
  private connectDirectWebSocket(url: string, resolve: () => void, reject: (error: any) => void): void {
    console.log(`🔄 MQTT Service: Direct WebSocket connection to ${url}`);
    
    if (!mqtt || typeof mqtt.connect !== 'function') {
      reject(new Error('MQTT library not available for direct connection'));
      return;
    }

    try {
      this.client = mqtt.connect(url, {
        ...this.options,
        clientId: `gate-control-direct-${Math.random().toString(16).substring(2, 8)}`
      });

      this.client.on('connect', async () => {
        console.log('✅ Direct WebSocket MQTT connection established');
        this.currentStatus.isConnected = true;
        await this.subscribeToTopics();
        this.notifyStatusChange();
        resolve();
      });

      this.client.on('message', (topic, message) => {
        this.handleMessage(topic, message.toString());
      });

      this.client.on('error', (error) => {
        console.error('❌ Direct WebSocket MQTT error:', error);
        this.currentStatus.isConnected = false;
        this.notifyStatusChange();
        reject(error);
      });

      this.client.on('close', () => {
        console.log('🔌 Direct WebSocket MQTT connection closed');
        this.currentStatus.isConnected = false;
        this.notifyStatusChange();
      });

    } catch (error) {
      console.error('❌ Direct WebSocket connection setup failed:', error);
      reject(error);
    }
  }

}

// Export singleton instance
export const mqttService = new MqttService();