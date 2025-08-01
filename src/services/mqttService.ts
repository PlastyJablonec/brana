// @ts-nocheck
import mqtt from 'mqtt';
import { db } from '../firebase/config';

export interface MqttStatus {
  gateStatus: string;
  garageStatus: string;
  isConnected: boolean;
}

export class MqttService {
  private client: any | null = null;
  private statusCallbacks: Array<(status: MqttStatus) => void> = [];
  private currentStatus: MqttStatus = {
    gateStatus: 'Neznámý stav',
    garageStatus: 'Neznámý stav',
    isConnected: false
  };

  constructor(
    private brokerUrl: string = process.env.REACT_APP_MQTT_URL || 'ws://89.24.76.191:9001',
    private options: any = {
      clientId: 'gate-control-' + Math.random().toString(16).substr(2, 8),
      clean: false, // Zachováme session
      reconnectPeriod: 5000, // Prodloužíme reconnect interval
      connectTimeout: 15 * 1000, // Prodloužíme timeout
      keepalive: 60, // Prodloužíme keepalive
      resubscribe: true,
      queueQoSZero: false,
      will: {
        topic: 'Log/Brana/Disconnect',
        payload: 'Client disconnected',
        qos: 1,
        retain: false
      }
    }
  ) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log(`🔌 Connecting to MQTT broker: ${this.brokerUrl}`);
        console.log('⚙️ MQTT options:', this.options);
        console.log('📚 MQTT library:', typeof mqtt, mqtt);
        
        if (!mqtt || typeof mqtt.connect !== 'function') {
          throw new Error('MQTT library not available - mqtt.connect is not a function');
        }
        
        this.client = mqtt.connect(this.brokerUrl, this.options);
        console.log('🔗 MQTT client created:', !!this.client);

        this.client.on('connect', () => {
          console.log('✅ MQTT Connected successfully');
          this.currentStatus.isConnected = true;
          console.log('🔄 MQTT status updated:', this.currentStatus);
          this.notifyStatusChange();
          
          // Subscribe to status topics
          this.client?.subscribe('IoT/Brana/Status', (err: any) => {
            if (err) console.error('Failed to subscribe to gate status:', err);
            else console.log('✅ Subscribed to IoT/Brana/Status');
          });
          
          this.client?.subscribe('IoT/Brana/Status2', (err: any) => {
            if (err) console.error('Failed to subscribe to garage status:', err);
            else console.log('✅ Subscribed to IoT/Brana/Status2');
          });
          
          resolve();
        });

        this.client.on('message', (topic: string, message: any) => {
          console.log(`📨 MQTT Message: ${topic} = ${message.toString()}`);
          this.handleMessage(topic, message.toString());
        });

        this.client.on('error', (error: any) => {
          console.error('MQTT Connection Error:', error);
          this.currentStatus.isConnected = false;
          this.notifyStatusChange();
          reject(error);
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
        console.error('MQTT Setup Error:', error);
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.client) {
      this.client.end();
      this.client = null;
      this.currentStatus.isConnected = false;
      this.notifyStatusChange();
    }
  }

  private handleMessage(topic: string, message: string): void {
    console.log(`📨 MQTT Message: ${topic} = ${message}`);
    
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
    }
    
    this.notifyStatusChange();
  }

  private parseGateStatus(status: string): string {
    // Parse gate status based on the original HTML implementation
    switch (status.toUpperCase()) {
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
        return status;
    }
  }

  private parseGarageStatus(status: string): string {
    // Parse garage status
    switch (status.toUpperCase()) {
      case 'P7':
        return 'Garáž zavřena';
      case 'P8':
        return 'Garáž otevřena';
      case 'P9':
        return 'Garáž - otevírá se...';
      case 'P10':
        return 'Garáž - zavírá se...';
      default:
        return status;
    }
  }

  async publishGateCommand(userEmail: string): Promise<void> {
    console.log('📡 publishGateCommand called for:', userEmail);
    console.log('🔌 MQTT client exists:', !!this.client);
    console.log('🔌 MQTT connected status:', this.currentStatus.isConnected);
    
    if (!this.client || !this.currentStatus.isConnected) {
      const error = `MQTT not connected - client: ${!!this.client}, connected: ${this.currentStatus.isConnected}`;
      console.error('❌', error);
      throw new Error(error);
    }

    const command = '1';
    console.log('📤 Publishing command:', command, 'for', userEmail);
    await this.publishCommand(command, userEmail, 'Brána');
  }

  async publishGarageCommand(userEmail: string): Promise<void> {
    if (!this.client || !this.currentStatus.isConnected) {
      throw new Error('MQTT not connected');
    }

    const command = '3';
    await this.publishCommand(command, userEmail, 'Garáž');
  }

  async publishStopCommand(userEmail: string): Promise<void> {
    if (!this.client || !this.currentStatus.isConnected) {
      throw new Error('MQTT not connected');
    }

    const command = '6';
    await this.publishCommand(command, userEmail, 'STOP režim');
  }

  private async publishCommand(command: string, userEmail: string, action: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('MQTT client not available'));
        return;
      }

      this.client.publish('IoT/Brana/Ovladani', command, { qos: 1 }, async (error: any) => {
        if (error) {
          console.error('MQTT Publish error:', error);
          reject(error);
        } else {
          console.log(`MQTT Command sent: ${command} by ${userEmail}`);
          
          // Log activity to Firestore (optional - doesn't block if AdBlocked)
          try {
            await db.collection('activity_logs').add({
              user: userEmail,
              action: action,
              command: command,
              timestamp: new Date(),
              status: 'sent'
            });
            console.log('Activity logged to Firestore (optional)');
          } catch (logError) {
            console.warn('Firestore logging failed, but command was sent successfully:', logError);
            // Don't throw error - MQTT command was successful!
          }
          
          resolve();
        }
      });
    });
  }

  async publishMessage(topic: string, message: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('MQTT client not available'));
        return;
      }

      this.client.publish(topic, message, { qos: 1 }, (error: any) => {
        if (error) {
          console.error('MQTT Publish error:', error);
          reject(error);
        } else {
          console.log(`MQTT Message sent to ${topic}: ${message}`);
          resolve();
        }
      });
    });
  }

  onStatusChange(callback: (status: MqttStatus) => void): () => void {
    this.statusCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
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

  getStatus(): MqttStatus {
    return { ...this.currentStatus };
  }

  isConnected(): boolean {
    return this.currentStatus.isConnected;
  }
}

// Export singleton instance
export const mqttService = new MqttService();