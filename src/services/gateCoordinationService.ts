import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

// Typy pro koordinaci brány
export interface GateUser {
  userId: string;
  userDisplayName: string;
  email: string;
  state: 'IDLE' | 'ACTIVE' | 'RESERVED' | 'AUTO_OPENING';
  timestamp: number;
  sessionId: string; // Jedinečné ID pro každou session uživatele
}

export interface GateCoordination {
  activeUser: GateUser | null;
  reservationQueue: GateUser[];
  gateState: 'CLOSED' | 'OPENING' | 'OPEN' | 'CLOSING' | 'STOPPED';
  lastActivity: number;
  autoOpeningUserId?: string; // ID uživatele, který čeká na automatické otevření
}


class GateCoordinationService {
  private coordinationDoc = doc(db, 'gate_coordination', 'current_state');
  private unsubscribe: (() => void) | null = null;
  private currentSessionId: string;
  
  // Event callbacks
  private onStateChange: ((state: GateCoordination) => void) | null = null;
  private onUserConflict: ((conflictInfo: { activeUser: GateUser, currentUser: string }) => void) | null = null;
  private onAutoOpenTrigger: ((userId: string) => void) | null = null;

  constructor() {
    this.currentSessionId = this.generateSessionId();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Inicializace služby a naslouchání změnám
  async initialize(): Promise<void> {
    try {
      // Vytvoř výchozí stav, pokud neexistuje
      const coordDoc = await getDoc(this.coordinationDoc);
      if (!coordDoc.exists()) {
        const initialState: GateCoordination = {
          activeUser: null,
          reservationQueue: [],
          gateState: 'CLOSED',
          lastActivity: Date.now(),
        };
        await setDoc(this.coordinationDoc, initialState);
      }

      // Naslouchej změnám v real-time
      this.unsubscribe = onSnapshot(this.coordinationDoc, (doc) => {
        if (doc.exists()) {
          const state = doc.data() as GateCoordination;
          if (this.onStateChange) {
            this.onStateChange(state);
          }
        }
      });

      console.log('🔧 GateCoordinationService: Inicializováno');
    } catch (error) {
      console.error('🔧 GateCoordinationService: Chyba při inicializaci:', error);
      throw error;
    }
  }

  // Ukončení služby
  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  // Registrace callback funkcí
  onCoordinationStateChange(callback: (state: GateCoordination) => void): void {
    this.onStateChange = callback;
  }

  onUserConflictDetected(callback: (conflictInfo: { activeUser: GateUser, currentUser: string }) => void): void {
    this.onUserConflict = callback;
  }

  onAutoOpeningTriggered(callback: (userId: string) => void): void {
    this.onAutoOpenTrigger = callback;
  }

  // Získání aktuálního stavu koordinace
  async getCurrentState(): Promise<GateCoordination | null> {
    try {
      const docSnap = await getDoc(this.coordinationDoc);
      return docSnap.exists() ? docSnap.data() as GateCoordination : null;
    } catch (error) {
      console.error('🔧 GateCoordinationService: Chyba při načítání stavu:', error);
      return null;
    }
  }

  // Pokus o aktivaci uživatele (začátek ovládání brány)
  async requestGateControl(userId: string, userDisplayName: string, email: string): Promise<'GRANTED' | 'DENIED' | 'QUEUED'> {
    try {
      const currentState = await this.getCurrentState();
      if (!currentState) return 'DENIED';

      const user: GateUser = {
        userId,
        userDisplayName,
        email,
        state: 'ACTIVE',
        timestamp: Date.now(),
        sessionId: this.currentSessionId
      };

      // Pokud nikdo neovládá bránu, udělej aktivního uživatele
      if (!currentState.activeUser) {
        const updatedState: GateCoordination = {
          ...currentState,
          activeUser: user,
          lastActivity: Date.now()
        };

        await setDoc(this.coordinationDoc, updatedState);
        console.log('🔧 GateCoordinationService: Uživatel', userDisplayName, 'je nyní aktivní');
        return 'GRANTED';
      }

      // Pokud už je někdo aktivní, zkontroluj konflikty
      if (currentState.activeUser.userId !== userId) {
        if (this.onUserConflict) {
          this.onUserConflict({
            activeUser: currentState.activeUser,
            currentUser: userId
          });
        }
        console.log('🔧 GateCoordinationService: Konflikt - aktivní je', currentState.activeUser.userDisplayName);
        return 'DENIED';
      }

      // Stejný uživatel - obnov session
      const updatedState: GateCoordination = {
        ...currentState,
        activeUser: { ...user, sessionId: this.currentSessionId },
        lastActivity: Date.now()
      };
      await setDoc(this.coordinationDoc, updatedState);
      return 'GRANTED';

    } catch (error) {
      console.error('🔧 GateCoordinationService: Chyba při žádosti o ovládání:', error);
      return 'DENIED';
    }
  }

  // Uvolnění ovládání brány
  async releaseGateControl(userId: string): Promise<void> {
    try {
      const currentState = await this.getCurrentState();
      if (!currentState?.activeUser || currentState.activeUser.userId !== userId) {
        return; // Uživatel není aktivní
      }

      // Zkontroluj, zda je někdo v queue
      const nextUser = currentState.reservationQueue[0];
      
      const updatedState: GateCoordination = {
        ...currentState,
        activeUser: nextUser ? { ...nextUser, state: 'ACTIVE' } : null,
        reservationQueue: nextUser ? currentState.reservationQueue.slice(1) : [],
        lastActivity: Date.now()
      };

      await setDoc(this.coordinationDoc, updatedState);
      console.log('🔧 GateCoordinationService: Uživatel', userId, 'uvolnil ovládání');

    } catch (error) {
      console.error('🔧 GateCoordinationService: Chyba při uvolňování ovládání:', error);
    }
  }

  // Přidání rezervace do queue
  async addReservation(userId: string, userDisplayName: string, email: string): Promise<boolean> {
    try {
      const currentState = await this.getCurrentState();
      if (!currentState) return false;

      // Zkontroluj, zda už není v queue
      const existsInQueue = currentState.reservationQueue.some(user => user.userId === userId);
      if (existsInQueue) {
        console.log('🔧 GateCoordinationService: Uživatel již je v queue');
        return true;
      }

      const reservationUser: GateUser = {
        userId,
        userDisplayName,
        email,
        state: 'RESERVED',
        timestamp: Date.now(),
        sessionId: this.currentSessionId
      };

      const updatedState: GateCoordination = {
        ...currentState,
        reservationQueue: [...currentState.reservationQueue, reservationUser],
        lastActivity: Date.now()
      };

      await setDoc(this.coordinationDoc, updatedState);
      console.log('🔧 GateCoordinationService: Uživatel', userDisplayName, 'přidán do queue');
      return true;

    } catch (error) {
      console.error('🔧 GateCoordinationService: Chyba při přidávání rezervace:', error);
      return false;
    }
  }

  // Odebrání rezervace z queue
  async removeReservation(userId: string): Promise<void> {
    try {
      const currentState = await this.getCurrentState();
      if (!currentState) return;

      const updatedQueue = currentState.reservationQueue.filter(user => user.userId !== userId);
      
      const updatedState: GateCoordination = {
        ...currentState,
        reservationQueue: updatedQueue,
        lastActivity: Date.now()
      };

      await setDoc(this.coordinationDoc, updatedState);
      console.log('🔧 GateCoordinationService: Rezervace uživatele', userId, 'odebrána');

    } catch (error) {
      console.error('🔧 GateCoordinationService: Chyba při odebírání rezervace:', error);
    }
  }

  // Aktualizace stavu brány (CLOSED, OPENING, OPEN, CLOSING)
  async updateGateState(newState: 'CLOSED' | 'OPENING' | 'OPEN' | 'CLOSING' | 'STOPPED'): Promise<void> {
    try {
      const currentState = await this.getCurrentState();
      if (!currentState) return;

      const updatedState: GateCoordination = {
        ...currentState,
        gateState: newState,
        lastActivity: Date.now()
      };

      // CHYTRÁ LOGIKA: Pokud se brána začíná zavírat a někdo čeká v queue
      if (newState === 'CLOSING' && currentState.reservationQueue.length > 0) {
        const nextUser = currentState.reservationQueue[0];
        updatedState.autoOpeningUserId = nextUser.userId;
        
        console.log('🔧 GateCoordinationService: Brána se zavírá, ale', nextUser.userDisplayName, 'čeká → automatické otevření');
        
        if (this.onAutoOpenTrigger) {
          this.onAutoOpenTrigger(nextUser.userId);
        }
      }

      await setDoc(this.coordinationDoc, updatedState);

    } catch (error) {
      console.error('🔧 GateCoordinationService: Chyba při aktualizaci stavu brány:', error);
    }
  }

  // Vyčištění starých/neaktivních session
  async cleanupInactiveSessions(maxAgeMinutes: number = 30): Promise<void> {
    try {
      const currentState = await this.getCurrentState();
      if (!currentState) return;

      const now = Date.now();
      const maxAge = maxAgeMinutes * 60 * 1000;
      let hasChanges = false;

      // Vyčisti neaktivní aktivní uživatele
      if (currentState.activeUser && (now - currentState.activeUser.timestamp) > maxAge) {
        currentState.activeUser = null;
        hasChanges = true;
        console.log('🔧 GateCoordinationService: Vyčištěn neaktivní aktivní uživatel');
      }

      // Vyčisti staré rezervace
      const validReservations = currentState.reservationQueue.filter(user => (now - user.timestamp) <= maxAge);
      if (validReservations.length !== currentState.reservationQueue.length) {
        currentState.reservationQueue = validReservations;
        hasChanges = true;
        console.log('🔧 GateCoordinationService: Vyčištěny staré rezervace');
      }

      if (hasChanges) {
        await setDoc(this.coordinationDoc, {
          ...currentState,
          lastActivity: now
        });
      }

    } catch (error) {
      console.error('🔧 GateCoordinationService: Chyba při čištění session:', error);
    }
  }

  // Utility funkce pro UI
  getUserPosition(userId: string, currentState: GateCoordination): number {
    if (currentState.activeUser?.userId === userId) return 0; // Aktivní
    const queueIndex = currentState.reservationQueue.findIndex(user => user.userId === userId);
    return queueIndex >= 0 ? queueIndex + 1 : -1; // Pozice v queue (+1 pro aktivního)
  }

  isUserBlocked(userId: string, currentState: GateCoordination): boolean {
    const isActiveUser = currentState.activeUser?.userId === userId;
    const isInQueue = currentState.reservationQueue.some(user => user.userId === userId);
    
    // Blokuj, pokud není aktivní ani v queue
    return !isActiveUser && !isInQueue && currentState.activeUser !== null;
  }

  getWaitingTime(position: number): string {
    if (position === 0) return 'Aktivní';
    if (position === 1) return 'Další na řadě';
    return `${position}. v pořadí`;
  }
}

export const gateCoordinationService = new GateCoordinationService();