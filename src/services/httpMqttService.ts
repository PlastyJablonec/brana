import { GateStatusType, GarageStatusType, IMqttStatus, IActivityLog } from './mqttService';
import { db } from '../firebase/config';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

type StatusCallback = (status: IMqttStatus) => void;
type UnsubscribeFunction = () => void;

export class HttpMqttService {
  private statusCallbacks: StatusCallback[] = [];
  private currentStatus: IMqttStatus = {
    gateStatus: 'Neznámý stav',
    garageStatus: 'Neznámý stav',
    isConnected: false
  };
  private statusPollingInterval: NodeJS.Timeout | null = null;
  private readonly proxyUrl = '/api/mqtt-proxy';

  public async connect(): Promise<void> {
    console.log('🌐 HTTP MQTT Service: Connecting via proxy...');
    
    try {
      // Test proxy connection
      const response = await fetch(this.proxyUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Proxy connection failed: ${response.status}`);
      }

      const status = await response.json();
      console.log('🌐 HTTP MQTT Proxy status:', status);

      this.currentStatus.isConnected = status.connected || false;
      this.notifyStatusChange();

      // Start polling for status updates
      this.startStatusPolling();

      console.log('✅ HTTP MQTT Service: Connected via proxy');
    } catch (error) {
      console.error('❌ HTTP MQTT Service: Connection failed:', error);
      this.currentStatus.isConnected = false;
      this.notifyStatusChange();
      throw error;
    }
  }

  private startStatusPolling(): void {
    // Poll every 2 seconds for status updates
    this.statusPollingInterval = setInterval(async () => {
      try {
        const response = await fetch(this.proxyUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const status = await response.json();
          const wasConnected = this.currentStatus.isConnected;
          let statusChanged = false;
          
          // Update connection status
          this.currentStatus.isConnected = status.connected || false;
          if (wasConnected !== this.currentStatus.isConnected) {
            console.log(`🔄 HTTP MQTT: Connection status changed: ${this.currentStatus.isConnected}`);
            statusChanged = true;
          }
          
          // Update gate and garage status from messages
          if (status.messages) {
            const oldGateStatus = this.currentStatus.gateStatus;
            const oldGarageStatus = this.currentStatus.garageStatus;
            
            if (status.messages['IoT/Brana/Status']) {
              this.currentStatus.gateStatus = this.parseGateStatus(status.messages['IoT/Brana/Status']);
              if (oldGateStatus !== this.currentStatus.gateStatus) {
                console.log(`🚪 HTTP MQTT: Gate status: ${oldGateStatus} → ${this.currentStatus.gateStatus}`);
                statusChanged = true;
              }
            }
            
            if (status.messages['IoT/Brana/Status2']) {
              this.currentStatus.garageStatus = this.parseGarageStatus(status.messages['IoT/Brana/Status2']);
              if (oldGarageStatus !== this.currentStatus.garageStatus) {
                console.log(`🏠 HTTP MQTT: Garage status: ${oldGarageStatus} → ${this.currentStatus.garageStatus}`);
                statusChanged = true;
              }
            }
          }
          
          if (statusChanged) {
            this.notifyStatusChange();
          }
        } else {
          if (this.currentStatus.isConnected) {
            console.warn('⚠️ HTTP MQTT: Proxy polling failed, marking as disconnected');
            this.currentStatus.isConnected = false;
            this.notifyStatusChange();
          }
        }
      } catch (error) {
        if (this.currentStatus.isConnected) {
          console.warn('⚠️ HTTP MQTT: Polling error, marking as disconnected:', error);
          this.currentStatus.isConnected = false;
          this.notifyStatusChange();
        }
      }
    }, 2000);
  }

  private parseGateStatus(status: string): GateStatusType {
    // Handle both text messages and P codes
    const upperStatus = status.toUpperCase();
    
    // If it's already a text message, return it directly (if valid)
    const validStatuses: GateStatusType[] = [
      'Brána zavřena', 'Brána otevřena', 'Otevírá se...', 
      'Zavírá se...', 'Zastavena', 'STOP režim'
    ];
    
    for (const validStatus of validStatuses) {
      if (status === validStatus) {
        console.log(`🔄 HTTP MQTT: Parsed gate status: ${status} (direct match)`);
        return validStatus;
      }
    }
    
    // Handle P codes
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
        console.warn(`HTTP MQTT: Unknown gate status received: ${status}`);
        return 'Neznámý stav';
    }
  }

  private parseGarageStatus(status: string): GarageStatusType {
    // Handle both text messages and P codes
    const validStatuses: GarageStatusType[] = [
      'Garáž zavřena', 'Garáž otevřena', 'Garáž - otevírá se...', 'Garáž - zavírá se...'
    ];
    
    for (const validStatus of validStatuses) {
      if (status === validStatus) {
        console.log(`🔄 HTTP MQTT: Parsed garage status: ${status} (direct match)`);
        return validStatus;
      }
    }
    
    // Handle P codes
    const upperStatus = status.toUpperCase();
    switch (upperStatus) {
      case 'P7':
        return 'Garáž zavřena';
      case 'P8':
        return 'Garáž otevřena';
      case 'P9':
        return 'Garáž - otevírá se...';
      case 'P10':
        return 'Garáž - zavírá se...';
      default:
        console.warn(`HTTP MQTT: Unknown garage status received: ${status}`);
        return 'Neznámý stav';
    }
  }

  public disconnect(): void {
    console.log('🔌 HTTP MQTT Service: Disconnecting...');
    
    if (this.statusPollingInterval) {
      clearInterval(this.statusPollingInterval);
      this.statusPollingInterval = null;
    }

    this.currentStatus.isConnected = false;
    this.notifyStatusChange();
    
    console.log('✅ HTTP MQTT Service: Disconnected');
  }

  public async publishGateCommand(userEmail: string): Promise<void> {
    console.log('📡 HTTP MQTT: publishGateCommand called for:', userEmail);
    
    if (!this.currentStatus.isConnected) {
      throw new Error('MQTT not connected via proxy');
    }

    const command = '1';
    console.log('📤 HTTP MQTT: Publishing gate command:', command, 'for', userEmail);
    await this.publishCommand('IoT/Brana/Ovladani', command, userEmail, 'Brána');
  }

  public async publishGarageCommand(userEmail: string): Promise<void> {
    if (!this.currentStatus.isConnected) {
      throw new Error('MQTT not connected via proxy');
    }

    const command = '3';
    await this.publishCommand('IoT/Brana/Ovladani', command, userEmail, 'Garáž');
  }

  public async publishStopCommand(userEmail: string): Promise<void> {
    if (!this.currentStatus.isConnected) {
      throw new Error('MQTT not connected via proxy');
    }

    const command = '6';
    await this.publishCommand('IoT/Brana/Ovladani', command, userEmail, 'STOP režim');
  }

  private async publishCommand(topic: string, message: string, userEmail: string, action: string): Promise<void> {
    try {
      console.log(`📤 HTTP MQTT: Publishing to ${topic}: ${message}`);
      
      const response = await fetch(this.proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          topic: topic,
          message: message
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Publish failed: ${errorData.error || response.statusText}`);
      }

      const result = await response.json();
      console.log(`✅ HTTP MQTT: Command sent:`, result);

      // Log activity to Firestore asynchronously
      this.logActivityToFirestore(userEmail, action, message)
        .then(() => console.log('📝 Activity logged to Firestore'))
        .catch(logError => {
          console.warn('⚠️ Firestore logging failed, but command was sent successfully:', logError);
        });

    } catch (error) {
      console.error('❌ HTTP MQTT: Publish error:', error);
      throw error;
    }
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

  public onStatusChange(callback: StatusCallback): UnsubscribeFunction {
    this.statusCallbacks.push(callback);
    
    return (): void => {
      this.statusCallbacks = this.statusCallbacks.filter(cb => cb !== callback);
    };
  }

  private notifyStatusChange(): void {
    console.log('🔧 HTTP MQTT Service: Notifying status change to', this.statusCallbacks.length, 'callbacks');
    console.log('🔧 HTTP MQTT Service: Current status:', this.currentStatus);
    
    this.statusCallbacks.forEach((callback, index) => {
      try {
        console.log(`🔧 HTTP MQTT Service: Calling callback ${index}...`);
        callback({...this.currentStatus});
        console.log(`🔧 HTTP MQTT Service: Callback ${index} completed`);
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
export const httpMqttService = new HttpMqttService();