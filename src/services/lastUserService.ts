import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export interface LastUserInfo {
  user: string;
  userDisplayName: string;
  timestamp: number;
  action: string;
  device: 'gate' | 'garage';
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
  };
}

export interface LastUserSettings {
  showLastUser: boolean;
  allowedRoles: string[]; // kdo může vidět posledního uživatele
  maxAgeHours: number; // jak staré záznamy zobrazovat (v hodinách)
}

class LastUserService {
  private settingsDoc = doc(db, 'settings', 'last_user_settings');
  private lastUserDoc = doc(db, 'last_activity', 'gate');
  private lastGarageUserDoc = doc(db, 'last_activity', 'garage');

  async getLastUserSettings(): Promise<LastUserSettings> {
    try {
      const docSnap = await getDoc(this.settingsDoc);
      
      if (docSnap.exists()) {
        return docSnap.data() as LastUserSettings;
      } else {
        // Default settings
        const defaultSettings: LastUserSettings = {
          showLastUser: true,
          allowedRoles: ['admin', 'user'], // všichni můžou vidět
          maxAgeHours: 24 // zobrazovat posledních 24 hodin
        };
        
        await setDoc(this.settingsDoc, defaultSettings);
        return defaultSettings;
      }
    } catch (error) {
      console.error('🔧 LastUserService: Error loading settings:', error);
      return {
        showLastUser: false,
        allowedRoles: ['admin'],
        maxAgeHours: 24
      };
    }
  }

  async saveLastUserSettings(settings: LastUserSettings): Promise<void> {
    try {
      await setDoc(this.settingsDoc, settings);
      console.log('🔧 LastUserService: Settings saved');
    } catch (error) {
      console.error('🔧 LastUserService: Error saving settings:', error);
      throw error;
    }
  }

  async updateLastUser(userInfo: LastUserInfo): Promise<void> {
    try {
      const docRef = userInfo.device === 'gate' ? this.lastUserDoc : this.lastGarageUserDoc;
      
      const lastUserData = {
        ...userInfo,
        timestamp: Date.now()
      };

      await setDoc(docRef, lastUserData);
      console.log('🔧 LastUserService: Last user updated for', userInfo.device, ':', userInfo.userDisplayName);
    } catch (error) {
      console.error('🔧 LastUserService: Error updating last user:', error);
      throw error;
    }
  }

  async getLastUser(device: 'gate' | 'garage' = 'gate'): Promise<LastUserInfo | null> {
    try {
      const docRef = device === 'gate' ? this.lastUserDoc : this.lastGarageUserDoc;
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data() as LastUserInfo;
        
        // Kontrola stáří záznamu
        const settings = await this.getLastUserSettings();
        const maxAgeMs = settings.maxAgeHours * 60 * 60 * 1000;
        const now = Date.now();
        
        if (now - data.timestamp <= maxAgeMs) {
          return data;
        } else {
          console.log('🔧 LastUserService: Last user data too old, ignoring');
          return null;
        }
      }
      
      return null;
    } catch (error) {
      console.error('🔧 LastUserService: Error getting last user:', error);
      return null;
    }
  }

  async canUserViewLastUser(userRole: string): Promise<boolean> {
    try {
      const settings = await this.getLastUserSettings();
      
      if (!settings.showLastUser) {
        return false;
      }
      
      return settings.allowedRoles.includes(userRole) || settings.allowedRoles.includes('all');
    } catch (error) {
      console.error('🔧 LastUserService: Error checking permissions:', error);
      return false;
    }
  }

  formatLastUserTime(timestamp: number): string {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) {
      return 'Právě teď';
    } else if (diffMinutes < 60) {
      return `Před ${diffMinutes} minutami`;
    } else if (diffHours < 24) {
      return `Před ${diffHours} hodinami`;
    } else {
      return `Před ${diffDays} dny`;
    }
  }

  // Automatické aktualizace posledního uživatele při aktivitě
  async logGateActivity(userEmail: string, userDisplayName: string, action: string, location?: any): Promise<void> {
    try {
      await this.updateLastUser({
        user: userEmail,
        userDisplayName,
        timestamp: Date.now(),
        action,
        device: 'gate',
        ...(location && { location })
      });
    } catch (error) {
      console.warn('🔧 LastUserService: Could not update last user:', error);
    }
  }

  async logGarageActivity(userEmail: string, userDisplayName: string, action: string, location?: any): Promise<void> {
    try {
      await this.updateLastUser({
        user: userEmail,
        userDisplayName,
        timestamp: Date.now(),
        action,
        device: 'garage',
        ...(location && { location })
      });
    } catch (error) {
      console.warn('🔧 LastUserService: Could not update last user:', error);
    }
  }
}

export const lastUserService = new LastUserService();