export interface MqttStatus {
  gateStatus: string;
  garageStatus: string;
  isConnected: boolean;
}

export class SimpleMqttService {
  private ws: WebSocket | null = null;
  private currentStatus: MqttStatus = {
    gateStatus: 'Neznámý',
    garageStatus: 'Neznámý', 
    isConnected: false
  };
  private statusListeners: ((status: MqttStatus) => void)[] = [];
  private brokerUrl: string = 'ws://89.24.76.191:9001';

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log('🔌 Connecting to MQTT via WebSocket:', this.brokerUrl);
        
        this.ws = new WebSocket(this.brokerUrl, ['mqtt']);
        
        this.ws.onopen = () => {
          console.log('✅ WebSocket MQTT Connected');
          this.currentStatus.isConnected = true;
          this.notifyStatusChange();
          resolve();
        };
        
        this.ws.onclose = () => {
          console.log('🔌 WebSocket MQTT Disconnected');
          this.currentStatus.isConnected = false;
          this.notifyStatusChange();
        };
        
        this.ws.onerror = (error) => {
          console.error('❌ WebSocket MQTT Error:', error);
          this.currentStatus.isConnected = false;
          this.notifyStatusChange();
          reject(error);
        };
        
        this.ws.onmessage = (event) => {
          console.log('📨 WebSocket message received:', event.data);
        };
        
      } catch (error) {
        console.error('❌ WebSocket setup error:', error);
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.currentStatus.isConnected = false;
      this.notifyStatusChange();
    }
  }

  async publishGateCommand(userEmail: string): Promise<void> {
    console.log('🚪 publishGateCommand called for:', userEmail);
    console.log('🔌 WebSocket exists:', !!this.ws);
    console.log('🔌 WebSocket connected:', this.currentStatus.isConnected);
    
    if (!this.ws || !this.currentStatus.isConnected) {
      const error = `WebSocket MQTT not connected - ws: ${!!this.ws}, connected: ${this.currentStatus.isConnected}`;
      console.error('❌', error);
      throw new Error(error);
    }

    return this.sendCommand('1', userEmail, 'Brána');
  }

  async publishGarageCommand(userEmail: string): Promise<void> {
    if (!this.ws || !this.currentStatus.isConnected) {
      throw new Error('WebSocket MQTT not connected');
    }
    return this.sendCommand('3', userEmail, 'Garáž');
  }

  async publishStopCommand(userEmail: string): Promise<void> {
    if (!this.ws || !this.currentStatus.isConnected) {
      throw new Error('WebSocket MQTT not connected');
    }
    return this.sendCommand('6', userEmail, 'STOP režim');
  }

  private sendCommand(command: string, userEmail: string, action: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log(`📤 Sending command: ${command} (${action}) for ${userEmail}`);
        
        // Simple MQTT PUBLISH packet for topic 'IoT/Brana/Ovladani'
        // This is a simplified version - in real MQTT we'd need proper packet formatting
        const message = JSON.stringify({
          topic: 'IoT/Brana/Ovladani',
          payload: command,
          user: userEmail,
          action: action,
          timestamp: new Date().toISOString()
        });
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(message);
          console.log('✅ Command sent successfully via WebSocket');
          resolve();
        } else {
          throw new Error('WebSocket not ready');
        }
        
      } catch (error) {
        console.error('❌ Failed to send command:', error);
        reject(error);
      }
    });
  }

  onStatusChange(callback: (status: MqttStatus) => void): () => void {
    this.statusListeners.push(callback);
    return () => {
      const index = this.statusListeners.indexOf(callback);
      if (index > -1) {
        this.statusListeners.splice(index, 1);
      }
    };
  }

  private notifyStatusChange(): void {
    console.log('🔄 Status change:', this.currentStatus);
    this.statusListeners.forEach(listener => listener(this.currentStatus));
  }

  getCurrentStatus(): MqttStatus {
    return { ...this.currentStatus };
  }
}

export const simpleMqttService = new SimpleMqttService();