export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  altitude?: number | null;
  altitudeAccuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
}

export interface LocationError {
  code: number;
  message: string;
}

class LocationService {
  private currentLocation: GeoLocation | null = null;
  private lastUpdateTime: number = 0;
  private isWatching: boolean = false;
  private watchId: number | null = null;

  /**
   * Získá aktuální polohu pomocí GPS podle vzoru z GPS.txt
   */
  async getCurrentLocation(): Promise<GeoLocation> {
    console.log('📍 LocationService: getCurrentLocation called');
    
    return new Promise((resolve, reject) => {
      // Kontrola, zda prohlížeč podporuje geolokaci
      if (!navigator.geolocation) {
        const error: LocationError = {
          code: 0,
          message: 'Váš prohlížeč nepodporuje geolokaci'
        };
        console.error('📍 LocationService: Geolocation not supported');
        reject(error);
        return;
      }

      console.log('📍 LocationService: Requesting GPS position...');

      // Získání aktuální pozice - přesně podle vzoru z GPS.txt
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Úspěšné získání pozice
          console.log('📍 LocationService: GPS SUCCESS - Got position:', position);
          
          const location: GeoLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: Date.now()
          };
          
          this.currentLocation = location;
          this.lastUpdateTime = Date.now();
          
          console.log('📍 LocationService: Location stored:', this.formatLocationString(location));
          resolve(location);
        },
        (error) => {
          // Chyba při získávání pozice - zpracování podle vzoru
          console.error('📍 LocationService: GPS ERROR:', error);
          const locationError = this.handleLocationError(error);
          reject(locationError);
        },
        {
          // Nastavení pro získání pozice - podle vzoru z GPS.txt
          enableHighAccuracy: true, // Vysoká přesnost (používá GPS)
          timeout: 10000, // Timeout 10 sekund
          maximumAge: 0 // Nepoužívat cache
        }
      );
    });
  }

  /**
   * Spustí kontinuální sledování pozice podle vzoru z GPS.txt
   */
  startWatching(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const error: LocationError = {
          code: 0,
          message: 'Váš prohlížeč nepodporuje geolokaci'
        };
        reject(error);
        return;
      }

      if (this.isWatching) {
        resolve();
        return;
      }

      console.log('📍 LocationService: Starting GPS watching...');
      this.isWatching = true;

      // Spuštění sledování pozice - podle vzoru z GPS.txt
      const id = navigator.geolocation.watchPosition(
        (position) => {
          console.log('📍 LocationService: GPS watch update:', position);
          
          const location: GeoLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: Date.now()
          };
          
          this.currentLocation = location;
          this.lastUpdateTime = Date.now();
          
          console.log('📍 LocationService: Watch position updated:', this.formatLocationString(location));
        },
        (error) => {
          console.error('📍 LocationService: GPS watch error:', error);
          this.handleLocationError(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );

      this.watchId = id;
      console.log('📍 LocationService: GPS watching started with ID:', id);
      resolve();
    });
  }

  /**
   * Zastaví sledování pozice
   */
  stopWatching(): void {
    if (this.watchId !== null) {
      console.log('📍 LocationService: Stopping GPS watch ID:', this.watchId);
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
      this.isWatching = false;
      console.log('📍 LocationService: GPS watching stopped');
    }
  }

  /**
   * Vrátí cached lokaci pokud je dostatečně čerstvá (max 5 minut)
   */
  getCachedLocation(): GeoLocation | null {
    const maxAge = 5 * 60 * 1000; // 5 minut
    if (this.currentLocation && (Date.now() - this.lastUpdateTime) < maxAge) {
      console.log('📍 LocationService: Returning cached location:', this.formatLocationString(this.currentLocation));
      return this.currentLocation;
    }
    console.log('📍 LocationService: No valid cached location available');
    return null;
  }

  /**
   * Získá lokaci pro aktivitu - buď cached nebo novou
   */
  async getLocationForActivity(): Promise<GeoLocation | null> {
    try {
      console.log('📍 LocationService: Getting location for activity...');
      
      // Zkusíme nejdřív cached lokaci
      const cached = this.getCachedLocation();
      if (cached) {
        console.log('📍 LocationService: Using cached location for activity');
        return cached;
      }

      // Pokud nemáme cached, zkusíme získat novou
      console.log('📍 LocationService: No cached location, requesting new GPS position...');
      return await this.getCurrentLocation();
    } catch (error: any) {
      console.warn('📍 LocationService: Cannot get location for activity:', error);
      return null;
    }
  }

  /**
   * Zpracování chyb podle vzoru z GPS.txt
   */
  private handleLocationError(error: GeolocationPositionError): LocationError {
    let message: string;
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        message = 'Přístup k poloze byl zamítnut. Povolte prosím přístup k poloze v nastavení prohlížeče.';
        break;
      case error.POSITION_UNAVAILABLE:
        message = 'Informace o poloze není dostupná. Zkontrolujte, zda máte zapnutou GPS.';
        break;
      case error.TIMEOUT:
        message = 'Časový limit vypršel. Zkuste to prosím znovu.';
        break;
      default:
        message = 'Nastala neznámá chyba při získávání polohy.';
        break;
    }

    console.error('📍 LocationService: GPS Error details:', {
      code: error.code,
      message: error.message,
      formattedMessage: message
    });

    return {
      code: error.code,
      message: message
    };
  }

  /**
   * Formátuje lokaci jako string
   */
  formatLocationString(location: GeoLocation): string {
    return `${location.latitude.toFixed(6)}°, ${location.longitude.toFixed(6)}° (±${Math.round(location.accuracy)}m)`;
  }

  /**
   * Vypočítá vzdálenost mezi dvěma lokacemi
   */
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

  /**
   * Zkontroluje, zda je geolokace podporována
   */
  isLocationSupported(): boolean {
    return 'geolocation' in navigator;
  }

  /**
   * Zkontroluje, zda je aplikace v bezpečném kontextu (HTTPS/localhost)
   */
  isSecureContext(): boolean {
    return window.isSecureContext || 
           window.location.protocol === 'https:' || 
           window.location.hostname === 'localhost' ||
           window.location.hostname === '127.0.0.1';
  }

  /**
   * Vrátí důvod, proč GPS není dostupné
   */
  getLocationUnavailableReason(): string {
    if (!this.isLocationSupported()) {
      return 'Geolocation není podporována v tomto prohlížeči';
    }
    if (!this.isSecureContext()) {
      return 'GPS vyžaduje HTTPS nebo localhost';
    }
    return 'GPS není dostupné';
  }

  /**
   * Požádá o oprávnění k lokaci
   */
  async requestPermission(): Promise<boolean> {
    if (!this.isLocationSupported() || !this.isSecureContext()) {
      console.log('📍 LocationService: Permission denied - unsupported or insecure context');
      return false;
    }

    try {
      console.log('📍 LocationService: Requesting GPS permission...');
      await this.getCurrentLocation();
      console.log('📍 LocationService: GPS permission granted');
      return true;
    } catch (error) {
      console.error('📍 LocationService: GPS permission denied:', error);
      return false;
    }
  }

  /**
   * Vrátí aktuální stav sledování
   */
  isCurrentlyWatching(): boolean {
    return this.isWatching;
  }

  /**
   * Vrátí poslední známou lokaci (bez ohledu na stáří)
   */
  getLastKnownLocation(): GeoLocation | null {
    return this.currentLocation;
  }
}

export const locationService = new LocationService();