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
  private gateLogCallbacks: GateLogCallback[] = [];
  private currentStatus: IMqttStatus = {
    gateStatus: 'Neznámý stav',
    garageStatus: 'Neznámý stav',
    isConnected: false
  };

  constructor(
    private readonly brokerUrl: string = typeof window !== 'undefined' && window.location.protocol === 'https:' 
      ? (process.env.REACT_APP_MQTT_WSS_URL || 'wss://89.24.76.191:9002')
      : (process.env.REACT_APP_MQTT_URL || 'ws://89.24.76.191:9001'),
    private readonly options: IMqttConnectionOptions = {
      clientId: `gate-control-${Math.random().toString(16).substring(2, 8)}`,
      clean: true,  // ⚡ TRUE pro okamžité retained messages
      reconnectPeriod: 3000,  // ⚡ Rychlejší reconnect
      connectTimeout: 8000,   // ⚡ Kratší timeout 
      keepalive: 30,          // ⚡ Rychlejší keepalive jako v simple HTML
      resubscribe: true,
      queueQoSZero: true,     // ⚡ Optimalizace pro rychlé zprávy
      will: {
        topic: 'Log/Brana/Disconnect',
        payload: 'Client disconnected',
        qos: 1,
        retain: false
      }
    }
  ) {}

  public async connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        console.log(`🔌 Connecting to MQTT broker: ${this.brokerUrl}`);
        console.log('⚙️ MQTT options:', this.options);
        
        // Handle protocol selection
        const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
        
        if (isHttps) {
          console.log('🌐 MQTT Service: HTTPS detected, using HTTP proxy instead of WebSocket');
          // Use HTTP proxy service on HTTPS
          httpMqttService.connect()
            .then(() => {
              console.log('✅ MQTT connected via HTTP proxy');
              this.currentStatus.isConnected = true;
              this.notifyStatusChange();
              
              // Forward HTTP MQTT status changes to this service
              httpMqttService.onStatusChange((status) => {
                this.currentStatus = { ...status };
                this.notifyStatusChange();
              });
              
              resolve();
            })
            .catch((error) => {
              console.error('❌ HTTP MQTT proxy connection failed:', error);
              this.currentStatus.isConnected = false;
              this.notifyStatusChange();
              reject(error);
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
      this.client.end(true); // Force close
      this.client = null;
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
    // Parse gate status based on the original HTML implementation
    const upperStatus = status.toUpperCase();
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
        console.warn(`Unknown gate status received: ${status}`);
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
}

// Export singleton instance
export const mqttService = new MqttService();