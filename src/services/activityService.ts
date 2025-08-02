import { collection, addDoc, getDocs, query, orderBy, limit, where, Timestamp, deleteDoc, doc, writeBatch } from 'firebase/firestore';
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

  async logActivity(activity: Omit<ActivityLog, 'id' | 'timestamp'>, skipLocation: boolean = false) {
    try {
      console.log('🔧 ActivityService: Logging activity:', activity);
      
      // Get location only if not explicitly skipped
      let location: GeoLocation | null = null;
      if (!skipLocation) {
        try {
          location = await locationService.getLocationForActivity();
          if (location) {
            console.log('📍 ActivityService: Location added to activity:', locationService.formatLocationString(location));
          }
        } catch (error) {
          console.warn('📍 ActivityService: Could not get location:', error);
          // Don't throw error, just continue without location
        }
      } else {
        console.log('📍 ActivityService: Skipping location for this activity');
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

  async deleteActivity(activityId: string): Promise<void> {
    try {
      console.log('🗑️ ActivityService: Deleting activity:', activityId);
      await deleteDoc(doc(db, 'activity_logs', activityId));
      console.log('✅ ActivityService: Activity deleted successfully');
    } catch (error) {
      console.error('❌ ActivityService: Error deleting activity:', error);
      throw error;
    }
  }

  async deleteActivitiesOlderThan(days: number): Promise<number> {
    try {
      console.log(`🗑️ ActivityService: Deleting activities older than ${days} days...`);
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffTimestamp = Timestamp.fromDate(cutoffDate);
      
      const q = query(
        this.collection,
        where('timestamp', '<', cutoffTimestamp)
      );

      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        console.log('🗑️ ActivityService: No old activities found to delete');
        return 0;
      }

      // Use batch delete for better performance
      const batch = writeBatch(db);
      querySnapshot.docs.forEach((docSnapshot) => {
        batch.delete(docSnapshot.ref);
      });

      await batch.commit();
      
      console.log(`✅ ActivityService: Deleted ${querySnapshot.docs.length} old activities`);
      return querySnapshot.docs.length;
    } catch (error) {
      console.error('❌ ActivityService: Error deleting old activities:', error);
      throw error;
    }
  }

  async deleteAllActivities(): Promise<number> {
    try {
      console.log('🗑️ ActivityService: Deleting all activities...');
      
      const querySnapshot = await getDocs(this.collection);
      
      if (querySnapshot.empty) {
        console.log('🗑️ ActivityService: No activities found to delete');
        return 0;
      }

      // Use batch delete for better performance
      const batch = writeBatch(db);
      querySnapshot.docs.forEach((docSnapshot) => {
        batch.delete(docSnapshot.ref);
      });

      await batch.commit();
      
      console.log(`✅ ActivityService: Deleted all ${querySnapshot.docs.length} activities`);
      return querySnapshot.docs.length;
    } catch (error) {
      console.error('❌ ActivityService: Error deleting all activities:', error);
      throw error;
    }
  }

  async deleteActivitiesByUser(userEmail: string): Promise<number> {
    try {
      console.log(`🗑️ ActivityService: Deleting activities for user: ${userEmail}`);
      
      const q = query(
        this.collection,
        where('user', '==', userEmail)
      );

      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        console.log(`🗑️ ActivityService: No activities found for user: ${userEmail}`);
        return 0;
      }

      // Use batch delete for better performance
      const batch = writeBatch(db);
      querySnapshot.docs.forEach((docSnapshot) => {
        batch.delete(docSnapshot.ref);
      });

      await batch.commit();
      
      console.log(`✅ ActivityService: Deleted ${querySnapshot.docs.length} activities for user: ${userEmail}`);
      return querySnapshot.docs.length;
    } catch (error) {
      console.error(`❌ ActivityService: Error deleting activities for user ${userEmail}:`, error);
      throw error;
    }
  }

  async deleteActivitiesByDevice(device: 'gate' | 'garage'): Promise<number> {
    try {
      console.log(`🗑️ ActivityService: Deleting activities for device: ${device}`);
      
      const q = query(
        this.collection,
        where('device', '==', device)
      );

      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        console.log(`🗑️ ActivityService: No activities found for device: ${device}`);
        return 0;
      }

      // Use batch delete for better performance
      const batch = writeBatch(db);
      querySnapshot.docs.forEach((docSnapshot) => {
        batch.delete(docSnapshot.ref);
      });

      await batch.commit();
      
      console.log(`✅ ActivityService: Deleted ${querySnapshot.docs.length} activities for device: ${device}`);
      return querySnapshot.docs.length;
    } catch (error) {
      console.error(`❌ ActivityService: Error deleting activities for device ${device}:`, error);
      throw error;
    }
  }
}

export const activityService = new ActivityService();