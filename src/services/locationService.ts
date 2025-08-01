export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface LocationError {
  code: number;
  message: string;
}

class LocationService {
  private currentLocation: GeoLocation | null = null;
  private lastUpdateTime: number = 0;
  private updateInterval: number = 30000; // 30 sekund
  private isWatching: boolean = false;
  private watchId: number | null = null;

  async getCurrentLocation(bypassPermissionCheck: boolean = false): Promise<GeoLocation> {
    console.log('📍 LocationService: getCurrentLocation called');
    console.log('📍 LocationService: bypassPermissionCheck:', bypassPermissionCheck);
    console.log('📍 LocationService: navigator.geolocation available:', !!navigator.geolocation);
    console.log('📍 LocationService: isSecureContext:', window.isSecureContext);
    console.log('📍 LocationService: protocol:', window.location.protocol);
    console.log('📍 LocationService: hostname:', window.location.hostname);
    
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        console.error('📍 LocationService: Geolocation not supported');
        reject({ code: 0, message: 'Geolocation není podporována v tomto prohlížeči' });
        return;
      }

      // Zkusíme různé strategie podle zařízení
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      const options: PositionOptions = {
        enableHighAccuracy: false, // Zkusíme nejdřív network-based lokaci 
        timeout: 10000, // Kratší timeout pro rychlejší fallback
        maximumAge: 300000 // 5 minut cache pro lepší performance
      };
      
      console.log('📍 LocationService: Device detection - isMobile:', isMobile);
      console.log('📍 LocationService: Using options:', options);

      console.log('📍 LocationService: Calling navigator.geolocation.getCurrentPosition with options:', options);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('📍 LocationService: SUCCESS - Got position:', position);
          const location: GeoLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: Date.now()
          };
          
          this.currentLocation = location;
          this.lastUpdateTime = Date.now();
          
          console.log('📍 LocationService: Current location:', location);
          resolve(location);
        },
        (error) => {
          console.error('📍 LocationService: ERROR - Geolocation error:', error);
          console.error('📍 LocationService: Error code:', error.code);
          console.error('📍 LocationService: Error message:', error.message);
          
          // Pro PC/desktop aplikace používáme automaticky fallback pro všechny chyby
          if (error.code === 2 || error.code === 3 || error.message.includes('429') || error.message.includes('network service') || error.message.includes('Timeout')) {
            console.log('📍 LocationService: GPS failed (code ' + error.code + '), using fallback location for desktop');
            const fallback = this.getFallbackLocation();
            this.currentLocation = fallback;
            this.lastUpdateTime = Date.now();
            console.log('📍 LocationService: ✅ SUCCESS - Fallback location resolved:', fallback);
            resolve(fallback);
            return;
          }
          
          // Jen pro permission denied (code 1) vraťme skutečnou chybu
          const locationError: LocationError = {
            code: error.code,
            message: this.getDetailedErrorMessage(error)
          };
          console.error('📍 LocationService: Formatted error:', locationError);
          reject(locationError);
        },
        options
      );
    });
  }

  startWatching(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject({ code: 0, message: 'Geolocation není podporována' });
        return;
      }

      if (this.isWatching) {
        resolve();
        return;
      }

      const options: PositionOptions = {
        enableHighAccuracy: false, // Network lokace pro PC
        timeout: 10000, // Kratší timeout
        maximumAge: 300000 // 5 minut cache
      };

      this.watchId = navigator.geolocation.watchPosition(
        (position) => {
          const location: GeoLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: Date.now()
          };
          
          this.currentLocation = location;
          this.lastUpdateTime = Date.now();
          
          console.log('📍 LocationService: Location updated:', location);
        },
        (error) => {
          console.error('📍 LocationService: Watch error:', this.getErrorMessage(error.code));
          
          // Při watch chybě použijeme fallback lokaci
          if (error.code === 2 || error.code === 3) {
            console.log('📍 LocationService: Watch failed, using fallback location');
            const fallback = this.getFallbackLocation();
            this.currentLocation = fallback;
            this.lastUpdateTime = Date.now();
          }
        },
        options
      );

      this.isWatching = true;
      console.log('📍 LocationService: Started watching location');
      resolve();
    });
  }

  stopWatching(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isWatching = false;
    console.log('📍 LocationService: Stopped watching location');
  }

  getCachedLocation(): GeoLocation | null {
    // Vrátíme cached lokaci jen pokud není starší než 5 minut
    if (this.currentLocation && (Date.now() - this.lastUpdateTime) < 300000) {
      return this.currentLocation;
    }
    return null;
  }

  async getLocationForActivity(): Promise<GeoLocation | null> {
    try {
      // Zkusíme nejdřív cached lokaci
      const cached = this.getCachedLocation();
      if (cached) {
        return cached;
      }

      // Pokud nemáme cached, zkusíme získat novou
      return await this.getCurrentLocation();
    } catch (error: any) {
      console.warn('📍 LocationService: Cannot get location for activity:', error);
      
      // Pokud je to Google API rate limit (429), použijeme fallback
      if (error.message && error.message.includes('429')) {
        console.log('📍 LocationService: Google API rate limited, using fallback location');
        return this.getFallbackLocation();
      }
      
      return null;
    }
  }

  private getFallbackLocation(): GeoLocation {
    // Praha centrum jako fallback pro desktop/PC aplikace
    console.log('📍 LocationService: Using fallback location (Praha centrum pro PC aplikace)');
    return {
      latitude: 50.0755,
      longitude: 14.4378,
      accuracy: 99999, // Vysoké číslo pro rozpoznání fallback
      timestamp: Date.now()
    };
  }

  formatLocationString(location: GeoLocation): string {
    return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
  }

  getDistanceString(location1: GeoLocation, location2: GeoLocation): string {
    const distance = this.calculateDistance(location1, location2);
    
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    } else {
      return `${distance.toFixed(1)}km`;
    }
  }

  private calculateDistance(loc1: GeoLocation, loc2: GeoLocation): number {
    const R = 6371; // Poloměr Země v km
    const dLat = this.deg2rad(loc2.latitude - loc1.latitude);
    const dLon = this.deg2rad(loc2.longitude - loc1.longitude);
    
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(loc1.latitude)) * Math.cos(this.deg2rad(loc2.latitude)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    return distance;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  private getErrorMessage(code: number): string {
    switch (code) {
      case 1:
        return 'Přístup k lokaci byl odepřen uživatelem';
      case 2:
        return 'Lokace není dostupná';
      case 3:
        return 'Vypršel časový limit pro získání lokace';
      default:
        return 'Neznámá chyba při získávání lokace';
    }
  }

  private getDetailedErrorMessage(error: GeolocationPositionError): string {
    const baseMessage = this.getErrorMessage(error.code);
    
    switch (error.code) {
      case 1: // PERMISSION_DENIED
        return `${baseMessage}. Zkontrolujte oprávnění v prohlížeči (ikona zámku v URL baru) nebo v nastavení stránky.`;
      case 2: // POSITION_UNAVAILABLE
        return `${baseMessage}. GPS signál není dostupný. Používám fallback lokaci Praha centrum.`;
      case 3: // TIMEOUT
        return `${baseMessage} (${10}s). GPS trvá příliš dlouho. Používám fallback lokaci.`;
      default:
        return `${baseMessage}. Detail: ${error.message}`;
    }
  }

  isLocationSupported(): boolean {
    return 'geolocation' in navigator;
  }

  isSecureContext(): boolean {
    const isSecure = window.isSecureContext || 
                    window.location.protocol === 'https:' || 
                    window.location.hostname === 'localhost' ||
                    window.location.hostname === '127.0.0.1';
    
    console.log('📍 LocationService: isSecureContext check:', {
      'window.isSecureContext': window.isSecureContext,
      'protocol': window.location.protocol,
      'hostname': window.location.hostname,
      'result': isSecure
    });
    
    return isSecure;
  }

  getLocationUnavailableReason(): string {
    if (!this.isLocationSupported()) {
      return 'Geolocation není podporována v tomto prohlížeči';
    }
    if (!this.isSecureContext()) {
      return 'GPS vyžaduje HTTPS nebo localhost. Aktuálně: ' + window.location.protocol;
    }
    return 'GPS není dostupné';
  }

  async requestPermission(): Promise<boolean> {
    if (!this.isLocationSupported() || !this.isSecureContext()) {
      return false;
    }

    try {
      await this.getCurrentLocation();
      return true;
    } catch (error) {
      return false;
    }
  }
}

export const locationService = new LocationService();