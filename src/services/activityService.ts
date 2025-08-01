import { collection, addDoc, getDocs, query, orderBy, limit, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { locationService, GeoLocation } from './locationService';

export interface ActivityLog {
  id?: string;
  timestamp: Timestamp;
  user: string;
  userDisplayName: string;
  action: string;
  device: 'gate' | 'garage';
  status: 'success' | 'error' | 'warning';
  details?: string;
  ipAddress?: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
  };
}

class ActivityService {
  private collection = collection(db, 'activity_logs');

  async logActivity(activity: Omit<ActivityLog, 'id' | 'timestamp'>) {
    try {
      console.log('🔧 ActivityService: Logging activity:', activity);
      
      // Pokusíme se získat lokaci pro aktivitu
      let location: GeoLocation | null = null;
      try {
        location = await locationService.getLocationForActivity();
        if (location) {
          console.log('📍 ActivityService: Location added to activity:', locationService.formatLocationString(location));
        }
      } catch (error) {
        console.warn('📍 ActivityService: Could not get location:', error);
      }
      
      const activityWithTimestamp = {
        ...activity,
        timestamp: Timestamp.now(),
        ...(location && { location })
      };

      const docRef = await addDoc(this.collection, activityWithTimestamp);
      console.log('🔧 ActivityService: Activity logged with ID:', docRef.id);
      
      return docRef.id;
    } catch (error) {
      console.error('🔧 ActivityService: Error logging activity:', error);
      throw error;
    }
  }

  async getRecentActivities(limitCount: number = 50): Promise<ActivityLog[]> {
    try {
      console.log('🔧 ActivityService: Fetching recent activities...');
      
      const q = query(
        this.collection,
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const activities: ActivityLog[] = [];

      querySnapshot.forEach((doc) => {
        activities.push({
          id: doc.id,
          ...doc.data()
        } as ActivityLog);
      });

      console.log('🔧 ActivityService: Fetched', activities.length, 'activities');
      return activities;
    } catch (error) {
      console.error('🔧 ActivityService: Error fetching activities:', error);
      return [];
    }
  }

  async getActivitiesByUser(userEmail: string, limitCount: number = 20): Promise<ActivityLog[]> {
    try {
      const q = query(
        this.collection,
        where('user', '==', userEmail),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const activities: ActivityLog[] = [];

      querySnapshot.forEach((doc) => {
        activities.push({
          id: doc.id,
          ...doc.data()
        } as ActivityLog);
      });

      return activities;
    } catch (error) {
      console.error('🔧 ActivityService: Error fetching user activities:', error);
      return [];
    }
  }

  async getActivitiesByDevice(device: 'gate' | 'garage', limitCount: number = 20): Promise<ActivityLog[]> {
    try {
      const q = query(
        this.collection,
        where('device', '==', device),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const activities: ActivityLog[] = [];

      querySnapshot.forEach((doc) => {
        activities.push({
          id: doc.id,
          ...doc.data()
        } as ActivityLog);
      });

      return activities;
    } catch (error) {
      console.error('🔧 ActivityService: Error fetching device activities:', error);
      return [];
    }
  }
}

export const activityService = new ActivityService();