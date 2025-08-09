import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

export type GarageTimerState = 'closed' | 'opening' | 'open' | 'closing';

export interface GarageTimerStatus {
  state: GarageTimerState;
  timeRemaining: number; // seconds
  isActive: boolean;
  lastUpdated: any; // server timestamp
  triggeredBy: string; // user email
}

type GarageStatusCallback = (status: GarageTimerStatus) => void;

export class GarageTimerService {
  private currentStatus: GarageTimerStatus = {
    state: 'closed',
    timeRemaining: 0,
    isActive: false,
    lastUpdated: null,
    triggeredBy: ''
  };

  private callbacks: GarageStatusCallback[] = [];
  private unsubscribeFirestore: (() => void) | null = null;
  private timerInterval: NodeJS.Timeout | null = null;
  private garageDocRef = doc(db, 'system_state', 'garage_timer');

  constructor() {
    this.initFirestoreListener();
  }

  private initFirestoreListener(): void {
    this.unsubscribeFirestore = onSnapshot(this.garageDocRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data() as GarageTimerStatus;
        console.log('🏠 GarageTimer: Received Firebase update:', data);
        this.currentStatus = { ...data };
        this.notifyCallbacks();
        
        // Start local countdown if timer is active
        if (data.isActive && data.timeRemaining > 0) {
          this.startLocalCountdown();
        } else {
          this.stopLocalCountdown();
        }
      } else {
        console.log('🏠 GarageTimer: No Firebase doc - initializing with closed state');
        this.initializeDefaultState();
      }
    }, (error) => {
      console.error('🏠 GarageTimer: Firebase listener error:', error);
    });
  }

  private async initializeDefaultState(): Promise<void> {
    const defaultStatus: GarageTimerStatus = {
      state: 'closed',
      timeRemaining: 0,
      isActive: false,
      lastUpdated: serverTimestamp(),
      triggeredBy: ''
    };

    try {
      await setDoc(this.garageDocRef, defaultStatus);
      console.log('🏠 GarageTimer: Default state initialized');
    } catch (error) {
      console.error('🏠 GarageTimer: Failed to initialize default state:', error);
    }
  }

  public async startGarageOperation(userEmail: string, movementTimeSeconds: number): Promise<void> {
    const newState: GarageTimerState = this.currentStatus.state === 'closed' ? 'opening' : 'closing';
    
    const newStatus: GarageTimerStatus = {
      state: newState,
      timeRemaining: movementTimeSeconds,
      isActive: true,
      lastUpdated: serverTimestamp(),
      triggeredBy: userEmail
    };

    console.log(`🏠 GarageTimer: Starting ${newState} operation for ${movementTimeSeconds}s`);

    try {
      await setDoc(this.garageDocRef, newStatus);
      console.log('🏠 GarageTimer: Operation started, Firebase updated');
    } catch (error) {
      console.error('🏠 GarageTimer: Failed to start operation:', error);
      throw error;
    }
  }

  private startLocalCountdown(): void {
    console.log(`🏠 GarageTimer: Starting local countdown for ${this.currentStatus.timeRemaining}s`);
    this.stopLocalCountdown(); // Clear any existing timer

    this.timerInterval = setInterval(() => {
      console.log(`🏠 GarageTimer: Countdown tick - ${this.currentStatus.timeRemaining}s remaining`);
      
      if (this.currentStatus.timeRemaining <= 0) {
        console.log('🏠 GarageTimer: Time reached 0, calling finishOperation()');
        this.finishOperation();
        return;
      }

      // Update local countdown
      this.currentStatus.timeRemaining -= 1;
      this.notifyCallbacks();

      // Sync to Firebase every 5 seconds to avoid too many writes
      if (this.currentStatus.timeRemaining % 5 === 0) {
        this.syncToFirebase();
      }
    }, 1000);
  }

  private stopLocalCountdown(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private async finishOperation(): Promise<void> {
    console.log('🏠 GarageTimer: finishOperation() called - stopping countdown');
    this.stopLocalCountdown();

    const finalState: GarageTimerState = this.currentStatus.state === 'opening' ? 'open' : 'closed';
    
    const finalStatus: GarageTimerStatus = {
      state: finalState,
      timeRemaining: 0,
      isActive: false,
      lastUpdated: serverTimestamp(),
      triggeredBy: this.currentStatus.triggeredBy
    };

    console.log(`🏠 GarageTimer: Operation finished - transitioning from ${this.currentStatus.state} to ${finalState}`);
    console.log('🏠 GarageTimer: Final status to save:', finalStatus);

    // Update local state immediately - FORCE UPDATE
    this.currentStatus = { ...finalStatus, lastUpdated: Date.now() }; // Use timestamp instead of serverTimestamp for local
    console.log('🏠 GarageTimer: About to notify callbacks with state:', this.currentStatus);
    this.notifyCallbacks();
    console.log('🏠 GarageTimer: Local state updated, callbacks notified');

    try {
      console.log('🏠 GarageTimer: Saving final state to Firebase...');
      await setDoc(this.garageDocRef, finalStatus);
      console.log('✅ GarageTimer: Final state successfully synced to Firebase');
    } catch (error) {
      console.error('❌ GarageTimer: Failed to sync final state to Firebase:', error);
      // Don't throw - local state is already updated
    }
  }

  private async syncToFirebase(): Promise<void> {
    if (!this.currentStatus.isActive) return;

    try {
      await setDoc(this.garageDocRef, {
        ...this.currentStatus,
        lastUpdated: serverTimestamp()
      });
      console.log(`🏠 GarageTimer: Synced ${this.currentStatus.timeRemaining}s to Firebase`);
    } catch (error) {
      console.error('🏠 GarageTimer: Failed to sync to Firebase:', error);
    }
  }

  public forceCloseState(): void {
    // Called when P1 message is received - always override to closed state
    console.log('🏠 GarageTimer: P1 received - forcing closed state');
    
    this.stopLocalCountdown();
    
    const closedStatus: GarageTimerStatus = {
      state: 'closed',
      timeRemaining: 0,
      isActive: false,
      lastUpdated: serverTimestamp(),
      triggeredBy: 'hardware_p1'
    };

    setDoc(this.garageDocRef, closedStatus).catch(error => {
      console.error('🏠 GarageTimer: Failed to force close state:', error);
    });
  }

  public getDisplayText(): string {
    switch (this.currentStatus.state) {
      case 'closed':
        return 'Garáž zavřena';
      case 'opening':
        return `Garáž - otevírá se... (${this.currentStatus.timeRemaining}s)`;
      case 'open':
        return 'Garáž otevřena';
      case 'closing':
        return `Garáž - zavírá se... (${this.currentStatus.timeRemaining}s)`;
      default:
        return 'Garáž - neznámý stav';
    }
  }

  public onStatusChange(callback: GarageStatusCallback): () => void {
    this.callbacks.push(callback);
    
    // Immediately call with current status
    callback(this.currentStatus);
    
    // Return unsubscribe function
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }

  private notifyCallbacks(): void {
    console.log(`🏠 GarageTimer: Notifying ${this.callbacks.length} callbacks with:`, this.currentStatus);
    this.callbacks.forEach((callback, index) => {
      try {
        console.log(`🏠 GarageTimer: Calling callback ${index} with state: ${this.currentStatus.state}`);
        callback({ ...this.currentStatus });
        console.log(`🏠 GarageTimer: Callback ${index} completed successfully`);
      } catch (error) {
        console.error(`🏠 GarageTimer: Callback ${index} error:`, error);
      }
    });
  }

  public getCurrentStatus(): GarageTimerStatus {
    return { ...this.currentStatus };
  }

  public destroy(): void {
    this.stopLocalCountdown();
    if (this.unsubscribeFirestore) {
      this.unsubscribeFirestore();
      this.unsubscribeFirestore = null;
    }
    this.callbacks = [];
  }
}

// Export singleton instance
export const garageTimerService = new GarageTimerService();