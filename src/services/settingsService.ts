import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export interface GateSettings {
  travelTime: number; // seconds - time for gate movement
  autoCloseTime: number; // seconds - time before auto close
  stopModeEnabled: boolean;
  notificationsEnabled: boolean;
}

export interface UserSettings {
  theme: 'light' | 'dark';
  language: 'cs' | 'en';
  notifications: boolean;
}

export interface AppSettings {
  gate: GateSettings;
  global: {
    maintenanceMode: boolean;
    maxUsersOnline: number;
    sessionTimeout: number; // minutes
  };
  lastUser: {
    showLastUser: boolean;
    allowedRoles: string[];
    maxAgeHours: number;
  };
}

class SettingsService {
  private settingsDoc = doc(db, 'settings', 'app_settings');

  async getAppSettings(): Promise<AppSettings> {
    try {
      console.log('🔧 SettingsService: Loading app settings...');
      
      const docSnap = await getDoc(this.settingsDoc);
      
      if (docSnap.exists()) {
        const data = docSnap.data() as AppSettings;
        
        // Migrace starých nastavení - přidáme chybějící lastUser sekci
        if (!data.lastUser) {
          data.lastUser = {
            showLastUser: true,
            allowedRoles: ['admin', 'user'],
            maxAgeHours: 24
          };
          // Uložíme migrovaná nastavení
          await this.saveAppSettings(data);
          console.log('🔧 SettingsService: Migrated old settings to include lastUser');
        }
        
        console.log('🔧 SettingsService: Settings loaded:', data);
        return data;
      } else {
        // Return default settings
        const defaultSettings: AppSettings = {
          gate: {
            travelTime: 31, // seconds for gate movement
            autoCloseTime: 240, // 4 minutes for auto close
            stopModeEnabled: false,
            notificationsEnabled: true
          },
          global: {
            maintenanceMode: false,
            maxUsersOnline: 10,
            sessionTimeout: 60
          },
          lastUser: {
            showLastUser: true,
            allowedRoles: ['admin', 'user'],
            maxAgeHours: 24
          }
        };
        
        console.log('🔧 SettingsService: Using default settings');
        
        // Save default settings
        await this.saveAppSettings(defaultSettings);
        return defaultSettings;
      }
    } catch (error) {
      console.error('🔧 SettingsService: Error loading settings:', error);
      // Return basic defaults on error
      return {
        gate: {
          travelTime: 31,
          autoCloseTime: 240,
          stopModeEnabled: false,
          notificationsEnabled: true
        },
        global: {
          maintenanceMode: false,
          maxUsersOnline: 10,
          sessionTimeout: 60
        },
        lastUser: {
          showLastUser: true,
          allowedRoles: ['admin', 'user'],
          maxAgeHours: 24
        }
      };
    }
  }

  async saveAppSettings(settings: AppSettings): Promise<void> {
    try {
      console.log('🔧 SettingsService: Saving app settings:', settings);
      await setDoc(this.settingsDoc, settings);
      console.log('🔧 SettingsService: Settings saved successfully');
    } catch (error) {
      console.error('🔧 SettingsService: Error saving settings:', error);
      throw error;
    }
  }

  async updateGateSettings(gateSettings: Partial<GateSettings>): Promise<void> {
    try {
      console.log('🔧 SettingsService: Updating gate settings:', gateSettings);
      await updateDoc(this.settingsDoc, {
        'gate': gateSettings
      });
      console.log('🔧 SettingsService: Gate settings updated');
    } catch (error) {
      console.error('🔧 SettingsService: Error updating gate settings:', error);
      throw error;
    }
  }

  // User-specific settings
  async getUserSettings(userId: string): Promise<UserSettings> {
    try {
      const userDoc = doc(db, 'user_settings', userId);
      const docSnap = await getDoc(userDoc);
      
      if (docSnap.exists()) {
        return docSnap.data() as UserSettings;
      } else {
        // Default user settings
        const defaultUserSettings: UserSettings = {
          theme: 'light',
          language: 'cs',
          notifications: true
        };
        
        await setDoc(userDoc, defaultUserSettings);
        return defaultUserSettings;
      }
    } catch (error) {
      console.error('🔧 SettingsService: Error loading user settings:', error);
      return {
        theme: 'light',
        language: 'cs',
        notifications: true
      };
    }
  }

  async saveUserSettings(userId: string, settings: UserSettings): Promise<void> {
    try {
      console.log('🔧 SettingsService: Saving user settings for', userId, ':', settings);
      const userDoc = doc(db, 'user_settings', userId);
      await setDoc(userDoc, settings);
      console.log('🔧 SettingsService: User settings saved');
    } catch (error) {
      console.error('🔧 SettingsService: Error saving user settings:', error);
      throw error;
    }
  }

  async updateUserTheme(userId: string, theme: 'light' | 'dark'): Promise<void> {
    try {
      console.log('🔧 SettingsService: Updating theme for', userId, 'to', theme);
      const userDoc = doc(db, 'user_settings', userId);
      await updateDoc(userDoc, { theme });
      console.log('🔧 SettingsService: Theme updated');
    } catch (error) {
      console.error('🔧 SettingsService: Error updating theme:', error);
      throw error;
    }
  }
}

export const settingsService = new SettingsService();