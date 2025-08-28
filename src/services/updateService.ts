export interface UpdateCheckResult {
  hasUpdate: boolean;
  error?: string;
}

class UpdateService {
  private callbacks: ((result: UpdateCheckResult) => void)[] = [];
  private updateAvailable = false;
  private swRegistration: ServiceWorkerRegistration | null = null;

  // NOVÁ IMPLEMENTACE: Service Worker based update detection
  public init(): void {
    if ('serviceWorker' in navigator) {
      console.log('🚀 UpdateService: Initializing SW-based update detection');
      
      // Registrace SW s callback pro update detection
      import('../serviceWorkerRegistration').then(({ register }) => {
        register({
          onUpdate: (registration) => {
            console.log('🆕 UpdateService: New version detected by Service Worker');
            this.swRegistration = registration;
            this.updateAvailable = true;
            this.notifyCallbacks({ hasUpdate: true });
          },
          onSuccess: (registration) => {
            console.log('📱 UpdateService: Service Worker successfully registered');
            this.swRegistration = registration;
          }
        });
      });

      // Poslouchání na controller change (po skip waiting)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('🔄 UpdateService: New service worker activated, reloading');
        window.location.reload();
      });
    } else {
      console.warn('⚠️ UpdateService: Service Workers not supported');
    }
  }

  public checkForUpdates(): Promise<UpdateCheckResult> {
    // Jednoduchá implementace - Service Worker už detekuje updates automaticky
    return Promise.resolve({ 
      hasUpdate: this.updateAvailable 
    });
  }

  public onUpdateAvailable(callback: (result: UpdateCheckResult) => void): () => void {
    this.callbacks.push(callback);
    
    // Pokud už je update dostupný, zavolej callback okamžitě
    if (this.updateAvailable) {
      callback({ hasUpdate: true });
    }
    
    // Return unsubscribe function
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }

  private notifyCallbacks(result: UpdateCheckResult): void {
    this.callbacks.forEach(callback => {
      try {
        callback(result);
      } catch (error) {
        console.error('❌ UpdateService: Error in update callback:', error);
      }
    });
  }

  public async forceRefresh(): Promise<void> {
    try {
      console.log('🔄 UpdateService: Applying update via Service Worker...');
      
      if (this.swRegistration && this.swRegistration.waiting) {
        // Pošli message SW aby aktivoval novou verzi
        this.swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
        console.log('⏭️ UpdateService: Skip waiting message sent to SW');
      } else {
        console.log('⚡ UpdateService: No waiting SW, performing hard reload...');
        window.location.reload();
      }
      
    } catch (error) {
      console.error('❌ UpdateService: Force refresh failed:', error);
      // Fallback - obyčejný reload
      window.location.reload();
    }
  }
}

// Export singleton instance
export const updateService = new UpdateService();