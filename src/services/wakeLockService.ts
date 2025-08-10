import NoSleep from 'nosleep.js';

export class WakeLockService {
  private wakeLock: any = null;
  private isSupported = false;
  private periodicInterval: NodeJS.Timeout | null = null;
  private noSleepVideo: HTMLVideoElement | null = null;
  private noSleep: NoSleep | null = null;
  private isNoSleepActive = false;

  constructor() {
    // Check if Wake Lock API is supported
    this.isSupported = 'wakeLock' in navigator;
    console.log('💡 WakeLock: API supported:', this.isSupported);
    
    // Initialize NoSleep.js
    try {
      this.noSleep = new NoSleep();
      console.log('💡 WakeLock: NoSleep.js initialized');
    } catch (error) {
      console.error('❌ WakeLock: NoSleep.js initialization failed:', error);
    }
  }

  public async requestWakeLock(): Promise<boolean> {
    // Try NoSleep.js first - most reliable cross-platform solution
    if (this.noSleep && !this.isNoSleepActive) {
      try {
        await this.noSleep.enable();
        this.isNoSleepActive = true;
        console.log('✅ WakeLock: NoSleep.js enabled successfully');
        return true;
      } catch (error) {
        console.error('❌ WakeLock: NoSleep.js failed:', error);
      }
    }

    // Fallback to native Wake Lock API
    if (this.isSupported) {
      try {
        // Release any existing wake lock first
        await this.releaseWakeLock();

        // Request screen wake lock
        this.wakeLock = await (navigator as any).wakeLock.request('screen');
        
        console.log('✅ WakeLock: Native API wake lock acquired');

        // Handle wake lock release (e.g., when tab becomes invisible)
        this.wakeLock.addEventListener('release', () => {
          console.log('💡 WakeLock: Native wake lock was released');
          // Try to re-enable NoSleep if native fails
          if (this.noSleep && !this.isNoSleepActive) {
            this.noSleep.enable().catch(e => console.log('NoSleep re-enable failed:', e));
          }
        });

        return true;
      } catch (error) {
        console.error('❌ WakeLock: Native API failed:', error);
      }
    }

    // Last resort - custom fallback methods
    console.log('💡 WakeLock: Using custom fallback methods');
    this.useFallbackMethods();
    return false;
  }

  public async releaseWakeLock(): Promise<void> {
    // Release NoSleep.js
    if (this.noSleep && this.isNoSleepActive) {
      try {
        this.noSleep.disable();
        this.isNoSleepActive = false;
        console.log('✅ WakeLock: NoSleep.js disabled');
      } catch (error) {
        console.error('❌ WakeLock: Error disabling NoSleep.js:', error);
      }
    }

    // Release native wake lock
    if (this.wakeLock) {
      try {
        await this.wakeLock.release();
        this.wakeLock = null;
        console.log('✅ WakeLock: Native wake lock released');
      } catch (error) {
        console.error('❌ WakeLock: Error releasing native wake lock:', error);
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

    // Method 5: Periodic interaction simulation (strongest fallback)
    this.startPeriodicActivity();

    // Method 6: NoSleep.js style approach
    this.createInvisibleVideoWithAudio();
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

  private startPeriodicActivity(): void {
    // Simulate user activity every 30 seconds to prevent screen timeout
    this.periodicInterval = setInterval(() => {
      // Method 1: Dispatch a synthetic touch event
      try {
        const touchEvent = new TouchEvent('touchstart', {
          bubbles: false,
          cancelable: true,
          touches: []
        });
        document.dispatchEvent(touchEvent);
      } catch (e) {
        // TouchEvent not supported, try mouse event
        try {
          const mouseEvent = new MouseEvent('mousemove', {
            bubbles: false,
            cancelable: true,
            clientX: 1,
            clientY: 1
          });
          document.dispatchEvent(mouseEvent);
        } catch (e2) {
          console.log('💡 WakeLock: Synthetic events not supported');
        }
      }

      // Method 2: Briefly modify DOM (invisible change)
      const body = document.body;
      const originalOpacity = body.style.opacity;
      body.style.opacity = '0.99999';
      setTimeout(() => {
        body.style.opacity = originalOpacity;
      }, 1);

      console.log('💡 WakeLock: Periodic activity simulated');
    }, 30000); // Every 30 seconds
  }

  private createInvisibleVideoWithAudio(): void {
    try {
      // This is the NoSleep.js approach - video with silent audio track
      this.noSleepVideo = document.createElement('video');
      this.noSleepVideo.setAttribute('title', 'No Sleep Video');
      this.noSleepVideo.setAttribute('playsinline', 'true');
      this.noSleepVideo.setAttribute('muted', 'true');
      this.noSleepVideo.setAttribute('loop', 'true');
      this.noSleepVideo.style.position = 'fixed';
      this.noSleepVideo.style.right = '0';
      this.noSleepVideo.style.bottom = '0';
      this.noSleepVideo.style.width = '1px';
      this.noSleepVideo.style.height = '1px';
      this.noSleepVideo.style.opacity = '0';
      this.noSleepVideo.style.pointerEvents = 'none';

      // MP4 video with silent audio track (base64 encoded)
      const videoDataUrl = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMWF2YzEAAAAIZnJlZQAAAAltZGF0AAAC7QYF//+p3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE2MSByMzAyMCA1ZGI2YWE2IC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAyMCAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4MzoweDExMyBtZT1oZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4eDhkY3Q9MSBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tMiB0aHJlYWRzPTEgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0zIGJfcHlyYW1pZD0yIGJfYWRhcHQ9MSBiX2JpYXM9MCBkaXJlY3Q9MSB3ZWlnaHRiPTEgb3Blbl9nb3A9MCB3ZWlnaHRwPTIga2V5aW50PTI1MCBrZXlpbnRfbWluPTEwIHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9NDAgcmM9Y3JmIG1idHJlZT0xIGNyZj0yMy4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMAAAABdliIQAm/0TAAYdeBTXzgAAAdxliIQAV/0TAAYdeBTXzgAACJBmiIQAV/0TAAYdeBTXzgAAAABBbW9vdgAAAGxtdmhkAAAAANdDz9HXQ8/RAAAD6AAABmwAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAO1dHJhawAAAFx0a2hkAAAAAdvdz9Hb3c/RAAAAEQAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAABAAAAAABAAAAAQAAAAA';

      this.noSleepVideo.src = videoDataUrl;
      document.body.appendChild(this.noSleepVideo);

      // Play the video
      this.noSleepVideo.play().then(() => {
        console.log('💡 WakeLock: NoSleep-style video playing');
      }).catch(error => {
        console.log('💡 WakeLock: NoSleep video failed:', error);
        // Remove failed video
        if (this.noSleepVideo && this.noSleepVideo.parentNode) {
          this.noSleepVideo.parentNode.removeChild(this.noSleepVideo);
          this.noSleepVideo = null;
        }
      });

    } catch (error) {
      console.log('💡 WakeLock: NoSleep video creation failed:', error);
    }
  }

  public cleanup(): void {
    this.releaseWakeLock();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Clean up periodic activity
    if (this.periodicInterval) {
      clearInterval(this.periodicInterval);
      this.periodicInterval = null;
    }

    // Clean up custom NoSleep video
    if (this.noSleepVideo && this.noSleepVideo.parentNode) {
      this.noSleepVideo.pause();
      this.noSleepVideo.parentNode.removeChild(this.noSleepVideo);
      this.noSleepVideo = null;
    }

    // Clean up NoSleep.js instance
    if (this.noSleep && this.isNoSleepActive) {
      try {
        this.noSleep.disable();
        this.isNoSleepActive = false;
      } catch (error) {
        console.log('NoSleep cleanup error:', error);
      }
    }

    console.log('💡 WakeLock: Service cleaned up');
  }

  public isWakeLockActive(): boolean {
    return this.wakeLock !== null || this.isNoSleepActive;
  }

  public isWakeLockSupported(): boolean {
    return this.isSupported;
  }

  public getWakeLockStatus(): string {
    if (this.isNoSleepActive) {
      return 'NoSleep.js aktivní';
    }
    if (this.wakeLock) {
      return 'Native API aktivní';
    }
    if (this.periodicInterval) {
      return 'Fallback metody aktivní';
    }
    return 'Neaktivní';
  }
}

// Export singleton instance
export const wakeLockService = new WakeLockService();