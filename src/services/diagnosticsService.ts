// Služba pro diagnostiku a debugging problémů s koordinací více uživatelů

export class DiagnosticsService {
  private static instance: DiagnosticsService;
  private isDebugModeEnabled = false;
  
  constructor() {
    // Detekce debug módu z localStorage
    this.isDebugModeEnabled = localStorage.getItem('gate-debug-mode') === 'true';
  }

  static getInstance(): DiagnosticsService {
    if (!DiagnosticsService.instance) {
      DiagnosticsService.instance = new DiagnosticsService();
    }
    return DiagnosticsService.instance;
  }

  // Zapnout/vypnout debug mód
  setDebugMode(enabled: boolean): void {
    this.isDebugModeEnabled = enabled;
    localStorage.setItem('gate-debug-mode', enabled.toString());
    console.log(`🔧 Debug mode ${enabled ? 'ZAPNUT' : 'VYPNUT'}`);
  }

  isDebugMode(): boolean {
    return this.isDebugModeEnabled;
  }

  // DIAGNOSTIC HELPER: Kontrola Firestore připojení
  async checkFirestoreConnection(): Promise<{ connected: boolean, error?: string, latency?: number }> {
    try {
      const startTime = Date.now();
      const { db } = await import('../firebase/config');
      
      // Pokus o rychlou operaci
      await db.collection('diagnostics').doc('test').get();
      const latency = Date.now() - startTime;
      
      return {
        connected: true,
        latency
      };
    } catch (error: any) {
      return {
        connected: false,
        error: error.message || error.toString()
      };
    }
  }

  // DIAGNOSTIC HELPER: Kontrola geolokace
  async checkGeolocationServices(): Promise<{ 
    browserSupport: boolean;
    permissionStatus: 'granted' | 'denied' | 'prompt' | 'unknown';
    lastKnownAccuracy?: number;
    error?: string;
  }> {
    const result = {
      browserSupport: !!navigator.geolocation,
      permissionStatus: 'unknown' as const,
      lastKnownAccuracy: undefined as number | undefined,
      error: undefined as string | undefined
    };

    if (!result.browserSupport) {
      result.error = 'Geolocation API není podporováno';
      return result;
    }

    // Kontrola oprávnění
    try {
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        result.permissionStatus = permission.state as any;
      }
    } catch (error: any) {
      console.warn('Nelze zjistit geolocation permission:', error);
    }

    // Test rychlé geolokace
    try {
      await new Promise<void>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            result.lastKnownAccuracy = position.coords.accuracy;
            resolve();
          },
          (error) => reject(new Error(`GPS Error ${error.code}: ${error.message}`)),
          { timeout: 5000, maximumAge: 60000, enableHighAccuracy: false }
        );
      });
    } catch (error: any) {
      result.error = error.message;
    }

    return result;
  }

  // DIAGNOSTIC HELPER: Kontrola MQTT služeb
  async checkMqttServices(): Promise<{
    connected: boolean;
    lastMessage?: string;
    latency?: number;
    error?: string;
  }> {
    try {
      const { mqttService } = await import('./mqttService');
      const startTime = Date.now();
      
      // Jednoduchá kontrola stavu
      const isConnected = mqttService.isConnected?.() || false;
      const latency = Date.now() - startTime;
      
      return {
        connected: isConnected,
        latency,
        lastMessage: 'Status check completed'
      };
    } catch (error: any) {
      return {
        connected: false,
        error: error.message || error.toString()
      };
    }
  }

  // COMPREHENSIVE DIAGNOSTIC: Kompletní diagnostika systému
  async runCompleteDiagnostics(): Promise<{
    timestamp: string;
    firestore: Awaited<ReturnType<DiagnosticsService['checkFirestoreConnection']>>;
    geolocation: Awaited<ReturnType<DiagnosticsService['checkGeolocationServices']>>;
    mqtt: Awaited<ReturnType<DiagnosticsService['checkMqttServices']>>;
    browser: {
      userAgent: string;
      isSecureContext: boolean;
      cookiesEnabled: boolean;
      localStorageAvailable: boolean;
    };
    network: {
      online: boolean;
      connectionType?: string;
      effectiveType?: string;
    };
  }> {
    console.log('🔍 Spouštím kompletní diagnostiku...');
    
    const [firestore, geolocation, mqtt] = await Promise.all([
      this.checkFirestoreConnection(),
      this.checkGeolocationServices(), 
      this.checkMqttServices()
    ]);

    // Browser info
    const browser = {
      userAgent: navigator.userAgent,
      isSecureContext: window.isSecureContext,
      cookiesEnabled: navigator.cookieEnabled,
      localStorageAvailable: (() => {
        try {
          localStorage.setItem('test', 'test');
          localStorage.removeItem('test');
          return true;
        } catch {
          return false;
        }
      })()
    };

    // Network info
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    const network = {
      online: navigator.onLine,
      connectionType: connection?.type,
      effectiveType: connection?.effectiveType
    };

    const result = {
      timestamp: new Date().toISOString(),
      firestore,
      geolocation,
      mqtt,
      browser,
      network
    };

    console.log('🔍 Diagnostika dokončena:', result);
    return result;
  }

  // HELPER: Exportuj diagnostiku jako JSON
  async exportDiagnostics(): Promise<string> {
    const diagnostics = await this.runCompleteDiagnostics();
    return JSON.stringify(diagnostics, null, 2);
  }

  // HELPER: Loguj detailní informace o koordinačním stavu
  logCoordinationState(state: any, context: string): void {
    if (!this.isDebugModeEnabled) return;

    console.group(`🔧 COORDINATION DEBUG: ${context}`);
    console.log('Timestamp:', new Date().toISOString());
    console.log('Active User:', state.activeUser ? {
      id: state.activeUser.userId,
      name: state.activeUser.userDisplayName,
      email: state.activeUser.email,
      sessionId: state.activeUser.sessionId
    } : null);
    console.log('Queue Length:', state.reservationQueue?.length || 0);
    console.log('Queue Users:', state.reservationQueue?.map((u: any) => u.userDisplayName) || []);
    console.log('Gate State:', state.gateState);
    console.log('Last Activity:', new Date(state.lastActivity).toLocaleString());
    console.groupEnd();
  }

  // HELPER: Performance monitoring
  createPerformanceMarker(name: string): () => number {
    const startTime = performance.now();
    return () => {
      const duration = performance.now() - startTime;
      if (this.isDebugModeEnabled) {
        console.log(`⏱️ PERFORMANCE: ${name} took ${duration.toFixed(2)}ms`);
      }
      return duration;
    };
  }
}

// Export singleton
export const diagnosticsService = DiagnosticsService.getInstance();