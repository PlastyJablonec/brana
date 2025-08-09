export class WakeLockService {
  private wakeLock: any = null;
  private isSupported = false;

  constructor() {
    // Check if Wake Lock API is supported
    this.isSupported = 'wakeLock' in navigator;
    console.log('💡 WakeLock: API supported:', this.isSupported);
  }

  public async requestWakeLock(): Promise<boolean> {
    if (!this.isSupported) {
      console.log('💡 WakeLock: API not supported, using fallback methods');
      this.useFallbackMethods();
      return false;
    }

    try {
      // Release any existing wake lock first
      await this.releaseWakeLock();

      // Request screen wake lock
      this.wakeLock = await (navigator as any).wakeLock.request('screen');
      
      console.log('✅ WakeLock: Screen wake lock acquired');

      // Handle wake lock release (e.g., when tab becomes invisible)
      this.wakeLock.addEventListener('release', () => {
        console.log('💡 WakeLock: Wake lock was released');
      });

      return true;
    } catch (error) {
      console.error('❌ WakeLock: Failed to acquire wake lock:', error);
      this.useFallbackMethods();
      return false;
    }
  }

  public async releaseWakeLock(): Promise<void> {
    if (this.wakeLock) {
      try {
        await this.wakeLock.release();
        this.wakeLock = null;
        console.log('✅ WakeLock: Wake lock released');
      } catch (error) {
        console.error('❌ WakeLock: Error releasing wake lock:', error);
      }
    }
  }

  private useFallbackMethods(): void {
    console.log('💡 WakeLock: Using fallback methods for older devices');
    
    // Method 1: Prevent page visibility changes from affecting screen
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Method 2: Play silent video (works on some mobile browsers)
    this.createSilentVideo();
    
    // Method 3: Prevent context menu on long press (reduces accidental screen off)
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    // Method 4: Add meta tag to prevent zoom and improve mobile experience
    this.addMobileOptimizations();
  }

  private handleVisibilityChange = () => {
    if (document.hidden) {
      console.log('💡 WakeLock: Page hidden - attempting to keep alive');
      // Try to request wake lock again when page becomes visible
      setTimeout(() => {
        if (!document.hidden) {
          this.requestWakeLock();
        }
      }, 1000);
    }
  };

  private createSilentVideo(): void {
    try {
      const video = document.createElement('video');
      video.muted = true;
      video.loop = true;
      video.style.position = 'fixed';
      video.style.top = '-1000px';
      video.style.left = '-1000px';
      video.style.width = '1px';
      video.style.height = '1px';
      video.style.opacity = '0';
      video.style.pointerEvents = 'none';

      // Create a very short, silent video data URL
      video.src = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMWF2YzEAAAAIZnJlZQAAAAxtZGF0AAAC7wYF//+p3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE2MSByMzAyMCA1ZGI2YWE2IC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAyMCAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4MzoweDExMyBtZT1oZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4eDhkY3Q9MSBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tMiB0aHJlYWRzPTEgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0zIGJfcHlyYW1pZD0yIGJfYWRhcHQ9MSBiX2JpYXM9MCBkaXJlY3Q9MSB3ZWlnaHRiPTEgb3Blbl9nb3A9MCB3ZWlnaHRwPTIga2V5aW50PTI1MCBrZXlpbnRfbWluPTEwIHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9NDAgcmM9Y3JmIG1idHJlZT0xIGNyZj0yMy4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMAAAAA5liIQAV/0TAAYdeBTXzgAAABdliIQAm/0TAAYdeBTXzg==';

      document.body.appendChild(video);
      
      video.play().catch(() => {
        // Silent video failed, remove it
        document.body.removeChild(video);
      });

      console.log('💡 WakeLock: Silent video created as fallback');
    } catch (error) {
      console.log('💡 WakeLock: Silent video fallback failed:', error);
    }
  }

  private addMobileOptimizations(): void {
    // Add or update viewport meta tag for better mobile experience
    let viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement;
    if (!viewportMeta) {
      viewportMeta = document.createElement('meta');
      viewportMeta.name = 'viewport';
      document.head.appendChild(viewportMeta);
    }
    viewportMeta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';

    // Add mobile-web-app-capable for PWA
    let appCapableMeta = document.querySelector('meta[name="mobile-web-app-capable"]') as HTMLMetaElement;
    if (!appCapableMeta) {
      appCapableMeta = document.createElement('meta');
      appCapableMeta.name = 'mobile-web-app-capable';
      appCapableMeta.content = 'yes';
      document.head.appendChild(appCapableMeta);
    }

    // Add apple-mobile-web-app-capable for iOS PWA
    let appleCapableMeta = document.querySelector('meta[name="apple-mobile-web-app-capable"]') as HTMLMetaElement;
    if (!appleCapableMeta) {
      appleCapableMeta = document.createElement('meta');
      appleCapableMeta.name = 'apple-mobile-web-app-capable';
      appleCapableMeta.content = 'yes';
      document.head.appendChild(appleCapableMeta);
    }

    console.log('💡 WakeLock: Mobile optimizations applied');
  }

  public cleanup(): void {
    this.releaseWakeLock();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    console.log('💡 WakeLock: Service cleaned up');
  }

  public isWakeLockActive(): boolean {
    return this.wakeLock !== null;
  }

  public isWakeLockSupported(): boolean {
    return this.isSupported;
  }
}

// Export singleton instance
export const wakeLockService = new WakeLockService();