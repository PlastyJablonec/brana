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
  private coordinationDoc = db.collection('gate_coordination').doc('current_state');
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
      const coordDoc = await this.coordinationDoc.get();
      if (!coordDoc.exists) {
        const initialState: GateCoordination = {
          activeUser: null,
          reservationQueue: [],
          gateState: 'CLOSED',
          lastActivity: Date.now(),
        };
        await this.coordinationDoc.set(initialState);
        console.log('🔧 GateCoordinationService: Vytvořen initial state');
      }

      // Naslouchej změnám v real-time
      this.unsubscribe = this.coordinationDoc.onSnapshot((doc: any) => {
        if (doc.exists) {
          const state = doc.data() as GateCoordination;
          console.log('🔧 GateCoordinationService: State change:', state);
          if (this.onStateChange) {
            this.onStateChange(state);
          }
        } else {
          console.warn('🔧 GateCoordinationService: Dokument neexistuje');
        }
      });

      console.log('🔧 GateCoordinationService: Inicializováno s Firebase v8 API');
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
    console.log('🔧 GateCoordinationService: Služba ukončena');
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
      const docSnap = await this.coordinationDoc.get();
      return docSnap.exists ? docSnap.data() as GateCoordination : null;
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

        await this.coordinationDoc.set(updatedState);
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
      await this.coordinationDoc.set(updatedState);
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

      await this.coordinationDoc.set(updatedState);
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

      await this.coordinationDoc.set(updatedState);
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

      await this.coordinationDoc.set(updatedState);
      console.log('🔧 GateCoordinationService: Rezervace uživatele', userId, 'odebrána');

    } catch (error) {
      console.error('🔧 GateCoordinationService: Chyba při odebírání rezervace:', error);
    }
  }

  // Aktualizace stavu brány (např. při MQTT změnách)
  async updateGateState(newState: 'CLOSED' | 'OPENING' | 'OPEN' | 'CLOSING' | 'STOPPED'): Promise<void> {
    try {
      const currentState = await this.getCurrentState();
      if (!currentState) return;

      // Automatické otevření při zavření brány
      if (newState === 'CLOSED' && currentState.gateState !== 'CLOSED' && currentState.reservationQueue.length > 0) {
        const nextUser = currentState.reservationQueue[0];
        
        const updatedState: GateCoordination = {
          ...currentState,
          gateState: newState,
          activeUser: nextUser,
          reservationQueue: currentState.reservationQueue.slice(1),
          autoOpeningUserId: nextUser.userId,
          lastActivity: Date.now()
        };
        
        await this.coordinationDoc.set(updatedState);
        
        // Trigger auto-opening callback
        if (this.onAutoOpenTrigger) {
          this.onAutoOpenTrigger(nextUser.userId);
        }
      } else {
        const updatedState: GateCoordination = {
          ...currentState,
          gateState: newState,
          lastActivity: Date.now()
        };

        await this.coordinationDoc.set(updatedState);
      }

    } catch (error) {
      console.error('🔧 GateCoordinationService: Chyba při aktualizaci stavu brány:', error);
    }
  }

  // HELPER METODY PRO useGateCoordination hook

  // Získání pozice uživatele (0 = aktivní, pozitivní číslo = pozice v queue, -1 = není zaregistrovaný)
  getUserPosition(userId: string, state: GateCoordination): number {
    if (state.activeUser?.userId === userId) return 0;
    const queueIndex = state.reservationQueue.findIndex(user => user.userId === userId);
    return queueIndex >= 0 ? queueIndex + 1 : -1;
  }

  // Kontrola, zda je uživatel blokován
  isUserBlocked(userId: string, state: GateCoordination): boolean {
    return state.activeUser !== null && state.activeUser.userId !== userId;
  }

  // Získání waiting time textu
  getWaitingTime(position: number): string {
    if (position === 0) return 'Aktivní';
    if (position === 1) return 'Další na řadě';
    if (position > 1) return `${position}. v pořadí`;
    return 'Nepřipojeno';
  }

  // Vyčištění neaktivních sessionů (parametr minutes)
  async cleanupInactiveSessions(minutes: number): Promise<void> {
    const timeoutMs = minutes * 60 * 1000;
    return this.cleanupStaleData(); // Využije existující logiku s timeout
  }

  // Vyčištění starých sessionů (cron job)
  async cleanupStaleData(): Promise<void> {
    try {
      const currentState = await this.getCurrentState();
      if (!currentState) return;

      const now = Date.now();
      const TIMEOUT_MS = 5 * 60 * 1000; // 5 minut timeout
      let hasChanges = false;

      // Vyčisti starého aktivního uživatele
      if (currentState.activeUser && (now - currentState.activeUser.timestamp) > TIMEOUT_MS) {
        currentState.activeUser = null;
        hasChanges = true;
      }

      // Vyčisti staré rezervace
      const validReservations = currentState.reservationQueue.filter(user => {
        return (now - user.timestamp) <= TIMEOUT_MS;
      });

      if (validReservations.length !== currentState.reservationQueue.length) {
        currentState.reservationQueue = validReservations;
        hasChanges = true;
      }

      if (hasChanges) {
        await this.coordinationDoc.set({
          ...currentState,
          lastActivity: now
        });
        console.log('🔧 GateCoordinationService: Stará data vyčištěna');
      }

    } catch (error) {
      console.error('🔧 GateCoordinationService: Chyba při čištění dat:', error);
    }
  }
}

// Export singleton instance
export const gateCoordinationService = new GateCoordinationService();
export default gateCoordinationService;