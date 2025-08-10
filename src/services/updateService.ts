export interface BuildInfo {
  version: string;
  buildTime: string;
  commit: string;
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion?: BuildInfo;
  latestVersion?: BuildInfo;
  error?: string;
}

class UpdateService {
  private checkInterval: NodeJS.Timeout | null = null;
  private callbacks: ((result: UpdateCheckResult) => void)[] = [];
  private lastCheckTime = 0;
  private checkCooldown = 5 * 60 * 1000; // 5 minut mezi kontrolami

  public async getCurrentBuildInfo(): Promise<BuildInfo | null> {
    try {
      // Získej build info z aktuální aplikace
      const response = await fetch('/build-info.json', {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      if (!response.ok) {
        throw new Error(`Build info fetch failed: ${response.status}`);
      }

      const buildInfo = await response.json();
      console.log('📦 UpdateService: Current build info:', buildInfo);
      return buildInfo;
    } catch (error) {
      console.error('❌ UpdateService: Error getting current build info:', error);
      return null;
    }
  }

  public async getLatestBuildInfo(): Promise<BuildInfo | null> {
    try {
      // Získej nejnovější build info ze serveru (s cache bypass)
      const cacheBuster = `?t=${Date.now()}`;
      const response = await fetch(`/build-info.json${cacheBuster}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      if (!response.ok) {
        throw new Error(`Latest build info fetch failed: ${response.status}`);
      }

      const buildInfo = await response.json();
      console.log('🆕 UpdateService: Latest build info:', buildInfo);
      return buildInfo;
    } catch (error) {
      console.error('❌ UpdateService: Error getting latest build info:', error);
      return null;
    }
  }

  public async checkForUpdates(): Promise<UpdateCheckResult> {
    const now = Date.now();
    
    // Cooldown - neověřuj příliš často
    if (now - this.lastCheckTime < this.checkCooldown) {
      console.log('⏳ UpdateService: Check skipped (cooldown active)');
      return { hasUpdate: false };
    }

    this.lastCheckTime = now;

    try {
      console.log('🔍 UpdateService: Checking for updates...');

      const [currentInfo, latestInfo] = await Promise.all([
        this.getCurrentBuildInfo(),
        this.getLatestBuildInfo()
      ]);

      if (!currentInfo || !latestInfo) {
        return {
          hasUpdate: false,
          error: 'Nelze získat informace o verzích'
        };
      }

      // Porovnej commit hashe
      const hasUpdate = currentInfo.commit !== latestInfo.commit;
      
      console.log(`📊 UpdateService: Version comparison:`, {
        current: currentInfo.commit,
        latest: latestInfo.commit,
        hasUpdate
      });

      const result: UpdateCheckResult = {
        hasUpdate,
        currentVersion: currentInfo,
        latestVersion: latestInfo
      };

      // Notifikuj callbacks pokud je update
      if (hasUpdate) {
        console.log('🎉 UpdateService: New version available!');
        this.notifyCallbacks(result);
      }

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Neznámá chyba';
      console.error('❌ UpdateService: Update check failed:', error);
      
      return {
        hasUpdate: false,
        error: errorMsg
      };
    }
  }

  public startPeriodicCheck(intervalMinutes: number = 15): void {
    if (this.checkInterval) {
      console.log('⚠️ UpdateService: Periodic check already running');
      return;
    }

    const intervalMs = intervalMinutes * 60 * 1000;
    console.log(`⏰ UpdateService: Starting periodic check every ${intervalMinutes} minutes`);

    // Spusť první kontrolu po 30 sekundách
    setTimeout(() => {
      this.checkForUpdates();
    }, 30000);

    // Pak každých X minut
    this.checkInterval = setInterval(() => {
      this.checkForUpdates();
    }, intervalMs);
  }

  public stopPeriodicCheck(): void {
    if (this.checkInterval) {
      console.log('🛑 UpdateService: Stopping periodic check');
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  public onUpdateAvailable(callback: (result: UpdateCheckResult) => void): () => void {
    this.callbacks.push(callback);
    
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

  public triggerUpdateNotification(result: UpdateCheckResult): void {
    this.notifyCallbacks(result);
  }

  public async forceRefresh(): Promise<void> {
    try {
      console.log('🔄 UpdateService: Force refreshing application...');
      
      // Pokus o service worker update
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          console.log('🔄 UpdateService: Updating service worker...');
          await registration.update();
          
          // Pokud má waiting worker, aktivuj ho
          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        }
      }

      // Vyčisti všechny cache
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => {
            console.log(`🗑️ UpdateService: Deleting cache: ${cacheName}`);
            return caches.delete(cacheName);
          })
        );
      }

      // Hard reload
      console.log('⚡ UpdateService: Performing hard reload...');
      window.location.reload();
      
    } catch (error) {
      console.error('❌ UpdateService: Force refresh failed:', error);
      // Fallback - obyčejný reload
      window.location.reload();
    }
  }

  public formatBuildTime(buildTime: string): string {
    try {
      const date = new Date(buildTime);
      return date.toLocaleString('cs-CZ', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return buildTime;
    }
  }

  public formatCommitHash(commit: string): string {
    return commit.length > 7 ? commit.substring(0, 7) : commit;
  }
}

// Export singleton instance
export const updateService = new UpdateService();