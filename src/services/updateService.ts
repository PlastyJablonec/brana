// updateService DOČASNĚ VYPNUT - způsoboval ChunkLoadError
export interface UpdateCheckResult {
  hasUpdate: boolean;
  error?: string;
}

class UpdateService {
  public init(): void {
    console.log('📱 UpdateService: Disabled to fix ChunkLoadError');
  }

  public checkForUpdates(): Promise<UpdateCheckResult> {
    return Promise.resolve({ hasUpdate: false });
  }

  public onUpdateAvailable(callback: (result: UpdateCheckResult) => void): () => void {
    return () => {}; // Empty unsubscribe
  }

  public async forceRefresh(): Promise<void> {
    window.location.reload();
  }
}

export const updateService = new UpdateService();