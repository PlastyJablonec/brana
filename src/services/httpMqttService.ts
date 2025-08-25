import { GateStatusType, GarageStatusType, IMqttStatus, IActivityLog, IGateLogEntry } from './mqttService';
import { db } from '../firebase/config';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

type StatusCallback = (status: IMqttStatus) => void;
type GateLogCallback = (logEntry: IGateLogEntry) => void;
type UnsubscribeFunction = () => void;

export class HttpMqttService {
  private statusCallbacks: StatusCallback[] = [];
  private gateLogCallbacks: GateLogCallback[] = [];
  private currentStatus: IMqttStatus = {
    gateStatus: 'Neznámý stav',
    garageStatus: 'Neznámý stav',
    isConnected: false
  };
  private statusPollingInterval: NodeJS.Timeout | null = null;
  private lastGateLogMessage: string | null = null; // Pro detekci nových zpráv
  private readonly proxyUrl = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3003/api/mqtt-proxy'  // Dev server with MQTT proxy
    : '/api/mqtt-proxy';  // Production Vercel serverless function

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

      // Immediate fetch for fast initial status
      await this.fetchStatusOnce();
      
      // Start polling for status updates
      this.startStatusPolling();

      // CRITICAL FIX: Always notify on first connection even if status didn't "change"
      // Dashboard needs to know current status values
      console.log('🚀 HTTP MQTT Service: Initial connection - force notifying current status');
      this.notifyStatusChange();

      // CRITICAL FIX: Force check for existing gate log messages on initial connection
      // This ensures LastGateActivity shows retained MQTT messages immediately
      console.log('🚀 HTTP MQTT Service: Checking for existing gate log messages after connection...');
      // Small delay to ensure all callbacks are registered
      setTimeout(async () => {
        await this.forceCheckGateLogMessage();
      }, 1000);

      console.log('✅ HTTP MQTT Service: Connected via proxy');
    } catch (error) {
      console.error('❌ HTTP MQTT Service: Connection failed:', error);
      console.error('🚨 HTTP MQTT Service: This might be due to Vercel authentication or API unavailability');
      this.currentStatus.isConnected = false;
      this.notifyStatusChange();
      throw error;
    }
  }

  private startStatusPolling(): void {
    console.log('🔄 HTTP MQTT Service: Starting status polling every 5s...');
    
    // Poll every 5 seconds for reasonable status updates (0.5s was too aggressive)
    this.statusPollingInterval = setInterval(async () => {
      try {
        // Tichý polling - logovat jen při problémech
        const response = await fetch(this.proxyUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const status = await response.json();
          // Tichý režim - logovat jen změny stavu
          const wasConnected = this.currentStatus.isConnected;
          let statusChanged = false;
          
          // Update connection status
          this.currentStatus.isConnected = status.connected || false;
          if (wasConnected !== this.currentStatus.isConnected) {
            console.log(`🔄 HTTP MQTT: Connection status changed: ${this.currentStatus.isConnected}`);
            statusChanged = true;
          }
          
          // Zpracovat MQTT zprávy
          
          // Update gate and garage status from messages
          if (status.messages) {
            const oldGateStatus = this.currentStatus.gateStatus;
            const oldGarageStatus = this.currentStatus.garageStatus;
            
            if (status.messages['IoT/Brana/Status']) {
              const parsedStatus = this.parseGateStatus(status.messages['IoT/Brana/Status']);
              console.log(`🚪 HTTP MQTT DEBUG: Raw: "${status.messages['IoT/Brana/Status']}" → Parsed: "${parsedStatus}"`);
              this.currentStatus.gateStatus = parsedStatus;
              if (oldGateStatus !== this.currentStatus.gateStatus) {
                console.log(`🚪 HTTP MQTT: Gate status CHANGED: ${oldGateStatus} → ${this.currentStatus.gateStatus}`);
                statusChanged = true;
              } else {
                console.log(`🚪 HTTP MQTT: Gate status SAME: ${oldGateStatus} (no change)`);
              }
            }
            
            if (status.messages['IoT/Brana/Status2']) {
              this.currentStatus.garageStatus = this.parseGarageStatus(status.messages['IoT/Brana/Status2']);
              if (oldGarageStatus !== this.currentStatus.garageStatus) {
                console.log(`🏠 HTTP MQTT: Garage status: ${oldGarageStatus} → ${this.currentStatus.garageStatus}`);
                statusChanged = true;
              }
            }
            
            // Handle Log/Brana/ID messages (gate activity log)
            if (status.messages['Log/Brana/ID']) {
              const newLogMessage = status.messages['Log/Brana/ID'];
              if (this.lastGateLogMessage !== newLogMessage) {
                console.log(`🎯 HTTP MQTT: New Log/Brana/ID message: "${this.lastGateLogMessage}" → "${newLogMessage}"`);
                this.lastGateLogMessage = newLogMessage;
                this.handleGateLogMessage(newLogMessage);
              }
            }
          } else {
            // PROBLEM: Proxy říká, že je connected, ale nevrací žádné messages
            if (this.currentStatus.isConnected) {
              console.warn('🚨 HTTP MQTT: Proxy connected but NO MESSAGES! This explains why gate status is stuck!');
              console.warn('🚨 HTTP MQTT: status.connected =', status.connected);
              console.warn('🚨 HTTP MQTT: status.messages =', status.messages);
            }
          }
          
          if (statusChanged) {
            console.log('🔔 HTTP MQTT: Status changed, notifying callbacks...');
            this.notifyStatusChange();
          } else {
            console.log('🔕 HTTP MQTT: No status change, skipping notification');
          }
        } else {
          console.error('❌ HTTP MQTT Service: Proxy polling failed - status:', response.status);
          if (this.currentStatus.isConnected) {
            console.warn('⚠️ HTTP MQTT: Proxy polling failed, marking as disconnected');
            this.currentStatus.isConnected = false;
            this.notifyStatusChange();
          }
        }
      } catch (error) {
        console.error('❌ HTTP MQTT Service: Polling error:', error);
        if (this.currentStatus.isConnected) {
          console.warn('⚠️ HTTP MQTT: Polling error, marking as disconnected:', error);
          this.currentStatus.isConnected = false;
          this.notifyStatusChange();
        }
      }
    }, 5000); // 5s polling - rozumný kompromis mezi rychlostí a výkonem
  }

  // Force check gate log messages on initial connection
  private async forceCheckGateLogMessage(): Promise<void> {
    try {
      console.log('🔍 HTTP MQTT Service: Force checking gate log messages...');
      const response = await fetch(this.proxyUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const status = await response.json();
        console.log('🔍 HTTP MQTT Service: Force check response:', status);
        
        if (status.messages && status.messages['Log/Brana/ID']) {
          const logMessage = status.messages['Log/Brana/ID'];
          console.log('🎯 HTTP MQTT Service: Force triggering gate log message:', logMessage);
          // ALWAYS trigger, ignore lastGateLogMessage comparison
          this.lastGateLogMessage = logMessage;
          this.handleGateLogMessage(logMessage);
        } else {
          console.log('🔍 HTTP MQTT Service: No Log/Brana/ID message found in force check');
        }
      } else {
        console.error('❌ HTTP MQTT Service: Force check failed - status:', response.status);
      }
    } catch (error) {
      console.error('❌ HTTP MQTT Service: Force check error:', error);
    }
  }

  // Immediate status fetch for fast initial load
  private async fetchStatusOnce(): Promise<void> {
    try {
      console.log('⚡ HTTP MQTT Service: Immediate status fetch...');
      const response = await fetch(this.proxyUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const status = await response.json();
        console.log('⚡ HTTP MQTT Service: Immediate response:', status);
        
        // DEBUG: Log messages state for immediate fetch
        console.log('🔍 HTTP MQTT Debug (immediate): status.messages =', status.messages);
        console.log('🔍 HTTP MQTT Debug (immediate): IoT/Brana/Status =', status.messages?.['IoT/Brana/Status']);
        
        // Process status immediately
        let statusChanged = false;
        const oldGateStatus = this.currentStatus.gateStatus;
        const oldGarageStatus = this.currentStatus.garageStatus;

        this.currentStatus.isConnected = status.connected || false;

        if (status.messages) {
          if (status.messages['IoT/Brana/Status']) {
            this.currentStatus.gateStatus = this.parseGateStatus(status.messages['IoT/Brana/Status']);
            if (oldGateStatus !== this.currentStatus.gateStatus) {
              console.log(`🚪 HTTP MQTT: Immediate gate status: ${oldGateStatus} → ${this.currentStatus.gateStatus}`);
              statusChanged = true;
            }
          }

          if (status.messages['IoT/Brana/Status2']) {
            this.currentStatus.garageStatus = this.parseGarageStatus(status.messages['IoT/Brana/Status2']);
            if (oldGarageStatus !== this.currentStatus.garageStatus) {
              console.log(`🏠 HTTP MQTT: Immediate garage status: ${oldGarageStatus} → ${this.currentStatus.garageStatus}`);
              statusChanged = true;
            }
          }

          // Handle Log/Brana/ID messages
          if (status.messages['Log/Brana/ID']) {
            const newLogMessage = status.messages['Log/Brana/ID'];
            if (this.lastGateLogMessage !== newLogMessage) {
              console.log(`🎯 HTTP MQTT: Immediate Log/Brana/ID: "${this.lastGateLogMessage}" → "${newLogMessage}"`);
              this.lastGateLogMessage = newLogMessage;
              this.handleGateLogMessage(newLogMessage);
            }
          }
        } else {
          // PROBLEM: Proxy říká, že je connected, ale nevrací žádné messages (immediate)
          if (this.currentStatus.isConnected) {
            console.warn('🚨 HTTP MQTT: Immediate fetch - Proxy connected but NO MESSAGES!');
            console.warn('🚨 HTTP MQTT: immediate status.connected =', status.connected);
            console.warn('🚨 HTTP MQTT: immediate status.messages =', status.messages);
          }
        }

        if (statusChanged) {
          this.notifyStatusChange();
        } else {
          // FORCE notification on immediate fetch to ensure Dashboard gets current status
          console.log('🚀 HTTP MQTT: Force notifying current status on immediate fetch');
          this.notifyStatusChange();
        }
      }
    } catch (error) {
      console.warn('⚠️ HTTP MQTT Service: Immediate fetch failed:', error);
      // Neblokuj připojení kvůli chybě immediate fetch
    }
  }

  private parseGateStatus(status: string): GateStatusType {
    // Handle both text messages and P codes
    const upperStatus = status.toUpperCase();
    
    // If it's already a text message, return it directly (if valid)
    const validStatuses: GateStatusType[] = [
      'Brána zavřena', 'Brána otevřena', 'Otevírá se...', 
      'Zavírá se...', 'Zastavena', 'STOP režim'
    ];
    
    // Handle alternative text formats
    if (status === 'Otevírám bránu') {
      console.log(`🔄 HTTP MQTT: Parsed gate status: ${status} → Otevírá se... (alternative format)`);
      return 'Otevírá se...';
    }
    
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
    
    // Handle P codes and movement messages
    const upperStatus = status.toUpperCase();
    
    // P1 = definitively closed (overrides timer)
    if (upperStatus === 'P1') {
      return 'Garáž zavřena';
    }
    
    // Movement message = hardware is moving (but we ignore this, timer controls state)
    if (upperStatus.includes('POHYB') || upperStatus.includes('POHYBU')) {
      console.log(`HTTP MQTT: Hardware movement message received: ${status} - ignoring, timer controls state`);
      return 'Neznámý stav'; // Don't override timer state
    }
    
    console.warn(`HTTP MQTT: Unknown garage status received: ${status} - expected P1 or pohyb message`);
    return 'Neznámý stav';
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
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || response.statusText;
        } catch (parseError) {
          console.warn('Could not parse error response:', parseError);
        }
        
        console.error(`❌ HTTP MQTT: Publish failed with status ${response.status}:`, errorMessage);
        throw new Error(`Publish failed: ${errorMessage}`);
      }

      let result;
      try {
        result = await response.json();
        console.log(`✅ HTTP MQTT: Command sent successfully:`, result);
      } catch (parseError) {
        console.warn('Could not parse success response, but request succeeded:', parseError);
        console.log(`✅ HTTP MQTT: Command sent (status ${response.status})`);
        result = { success: true, status: response.status };
      }

      // Note: Activity logging is now handled in Dashboard.tsx with detailed actions
      // This old logging system created generic "Brána"/"Garáž" entries

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

  public async publishMessage(topic: string, message: string): Promise<void> {
    console.log(`📤 HTTP MQTT: publishMessage called for topic: ${topic}, message: ${message}`);
    
    if (!this.currentStatus.isConnected) {
      throw new Error('MQTT not connected via proxy');
    }

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
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || response.statusText;
        } catch (parseError) {
          console.warn('Could not parse error response:', parseError);
        }
        
        console.error(`❌ HTTP MQTT: publishMessage failed with status ${response.status}:`, errorMessage);
        throw new Error(`Publish failed: ${errorMessage}`);
      }

      let result;
      try {
        result = await response.json();
        console.log(`✅ HTTP MQTT: Message sent successfully:`, result);
      } catch (parseError) {
        console.warn('Could not parse success response, but request succeeded:', parseError);
        console.log(`✅ HTTP MQTT: Message sent (status ${response.status})`);
      }

    } catch (error) {
      console.error('❌ HTTP MQTT: publishMessage error:', error);
      throw error;
    }
  }

  private handleGateLogMessage(message: string): void {
    console.log(`🎯 HTTP MQTT Service: Log/Brana/ID message received: "${message}"`);
    console.log(`📋 Gate Log: External activity detected - ID: ${message}`);
    
    const logEntry: IGateLogEntry = {
      id: message.trim(),
      timestamp: new Date(),
      source: 'external'
    };
    
    console.log('🔔 HTTP MQTT Service: Notifying gate log callbacks with:', logEntry);
    // Notify all gate log callbacks
    this.notifyGateLogChange(logEntry);
  }

  private notifyGateLogChange(logEntry: IGateLogEntry): void {
    console.log('🔧 HTTP MQTT Service: Notifying gate log change to', this.gateLogCallbacks.length, 'callbacks');
    
    this.gateLogCallbacks.forEach((callback, index) => {
      try {
        console.log(`🔧 HTTP MQTT Service: Calling gate log callback ${index}...`);
        callback(logEntry);
      } catch (error) {
        console.error(`❌ HTTP MQTT Service: Error in gate log callback ${index}:`, error);
      }
    });
  }

  public onGateLogChange(callback: GateLogCallback): UnsubscribeFunction {
    this.gateLogCallbacks.push(callback);
    
    console.log('✅ HTTP MQTT Service: onGateLogChange registered - Log/Brana/ID subscription via HTTP proxy enabled');
    
    // Return unsubscribe function
    return (): void => {
      this.gateLogCallbacks = this.gateLogCallbacks.filter(cb => cb !== callback);
    };
  }
}

// Export singleton instance
export const httpMqttService = new HttpMqttService();