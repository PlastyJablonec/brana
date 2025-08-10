import { activityService } from './activityService';
import { mqttService, IGateLogEntry } from './mqttService';

export interface CombinedGateActivity {
  id: string;
  timestamp: Date;
  user?: string;
  userDisplayName?: string;
  source: 'app' | 'external';
  action?: string;
  details?: string;
}

export class GateActivityService {
  private recentExternalLogs: IGateLogEntry[] = [];
  private callbacks: ((activities: CombinedGateActivity[]) => void)[] = [];
  private maxExternalLogs = 10; // Kolik external logů si pamatujeme

  constructor() {
    console.log('🔧 GateActivityService: Initializing...');
    
    // Listen na MQTT external logs
    mqttService.onGateLogChange((logEntry: IGateLogEntry) => {
      console.log('🔔 GateActivityService: Received MQTT gate log callback');
      this.handleExternalLog(logEntry);
    });
    
    console.log('✅ GateActivityService: Initialized and subscribed to MQTT logs');
  }

  private handleExternalLog(logEntry: IGateLogEntry): void {
    console.log('🔧 GateActivityService: Received external log:', logEntry);
    
    // Přidej na začátek seznamu
    this.recentExternalLogs.unshift(logEntry);
    
    // Omez počet záznamů
    if (this.recentExternalLogs.length > this.maxExternalLogs) {
      this.recentExternalLogs = this.recentExternalLogs.slice(0, this.maxExternalLogs);
    }
    
    // Notifikuj všechny callbacks
    this.notifyCallbacks();
  }

  public async getCombinedGateActivities(limit: number = 10): Promise<CombinedGateActivity[]> {
    try {
      console.log(`🔧 GateActivityService: Fetching combined gate activities (limit: ${limit})...`);
      
      // Načti app activity logs pro bránu
      console.log('📊 GateActivityService: Fetching app logs from Firebase...');
      const appLogs = await activityService.getActivitiesByDevice('gate', limit);
      console.log(`📊 GateActivityService: Found ${appLogs.length} app logs:`, appLogs);
      
      // Konvertuj app logs
      const appActivities: CombinedGateActivity[] = appLogs.map(log => ({
        id: log.id || 'unknown',
        timestamp: log.timestamp.toDate(),
        user: log.user,
        userDisplayName: log.userDisplayName,
        source: 'app' as const,
        action: log.action,
        details: log.details
      }));
      
      // Konvertuj external logs
      console.log(`📊 GateActivityService: Processing ${this.recentExternalLogs.length} external logs:`, this.recentExternalLogs);
      const externalActivities: CombinedGateActivity[] = this.recentExternalLogs.map(log => ({
        id: `external_${log.id}_${log.timestamp.getTime()}`,
        timestamp: log.timestamp,
        source: 'external' as const,
        details: `External ovládání - ID: ${log.id}`
      }));
      
      // Zkombinuj a seřaď podle času (nejnovější první)
      const combined = [...appActivities, ...externalActivities]
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, limit);
      
      console.log(`✅ GateActivityService: Combined ${combined.length} activities (${appActivities.length} app + ${externalActivities.length} external):`, combined);
      
      return combined;
    } catch (error) {
      console.error('❌ GateActivityService: Error fetching combined activities:', error);
      return [];
    }
  }

  public onActivitiesChange(callback: (activities: CombinedGateActivity[]) => void): () => void {
    this.callbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }

  private async notifyCallbacks(): Promise<void> {
    try {
      const activities = await this.getCombinedGateActivities();
      this.callbacks.forEach(callback => {
        try {
          callback(activities);
        } catch (error) {
          console.error('❌ GateActivityService: Error in callback:', error);
        }
      });
    } catch (error) {
      console.error('❌ GateActivityService: Error notifying callbacks:', error);
    }
  }

  public formatActivityTime(timestamp: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) {
      return 'právě teď';
    } else if (diffMinutes < 60) {
      return `před ${diffMinutes}m`;
    } else if (diffHours < 24) {
      return `před ${diffHours}h`;
    } else if (diffDays < 7) {
      return `před ${diffDays}d`;
    } else {
      return timestamp.toLocaleDateString('cs-CZ', {
        day: 'numeric',
        month: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }

  public formatActivityDetails(activity: CombinedGateActivity): string {
    if (activity.source === 'app') {
      const user = activity.userDisplayName || activity.user || 'Neznámý uživatel';
      const action = activity.action || 'Ovládání brány';
      return `${user} - ${action}`;
    } else {
      return activity.details || `External ovládání - ID: ${activity.id}`;
    }
  }
}

// Export singleton instance
export const gateActivityService = new GateActivityService();