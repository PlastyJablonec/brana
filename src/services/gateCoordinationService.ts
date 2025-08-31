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
      console.log('🚨 DEBUG: GateCoordinationService.initialize() START');
      console.log('🚨 DEBUG: db object:', db);
      console.log('🚨 DEBUG: coordinationDoc:', this.coordinationDoc);
      
      // Vytvoř výchozí stav, pokud neexistuje
      console.log('🚨 DEBUG: Načítám dokument z Firestore...');
      const coordDoc = await this.coordinationDoc.get();
      console.log('🚨 DEBUG: Dokument načten, exists:', coordDoc.exists, 'data:', coordDoc.data());
      
      if (!coordDoc.exists) {
        console.log('🚨 DEBUG: Dokument neexistuje, vytvářím initial state...');
        const initialState: GateCoordination = {
          activeUser: null,
          reservationQueue: [],
          gateState: 'CLOSED',
          lastActivity: Date.now(),
        };
        await this.coordinationDoc.set(initialState);
        console.log('✅ GateCoordinationService: Vytvořen initial state');
      } else {
        console.log('✅ GateCoordinationService: Dokument už existuje');
      }

      // Naslouchej změnám v real-time
      console.log('🚨 DEBUG: Registruji onSnapshot listener...');
      this.unsubscribe = this.coordinationDoc.onSnapshot((doc: any) => {
        console.log('🔔 SNAPSHOT CALLBACK: doc.exists =', doc.exists, 'data =', doc.data());
        if (doc.exists) {
          const state = doc.data() as GateCoordination;
          console.log('🔧 GateCoordinationService: State change:', state);
          console.log('🔧 ACTIVE USER DETAILS:', state.activeUser ? {
            userId: state.activeUser.userId,
            userDisplayName: state.activeUser.userDisplayName,
            email: state.activeUser.email
          } : 'null');
          if (this.onStateChange) {
            console.log('🔧 GateCoordinationService: Volám onStateChange callback');
            this.onStateChange(state);
          } else {
            console.warn('⚠️ GateCoordinationService: onStateChange callback není nastaven!');
          }
        } else {
          console.warn('🔧 GateCoordinationService: Dokument neexistuje');
        }
      });

      console.log('✅ GateCoordinationService: Inicializováno s Firebase v8 API');
    } catch (error) {
      console.error('❌ GateCoordinationService: KRITICKÁ CHYBA při inicializaci:', error);
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

  // NOVÁ LOGIKA: Aktivace jen při skutečném ovládání brány
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

      // KRITICKÁ OPRAVA: Atomická transakce pro race condition ochranu
      // Použijeme Firebase Transaction pro garantovanou atomicitu
      const transactionResult = await db.runTransaction(async (transaction: any) => {
        const freshDoc = await transaction.get(this.coordinationDoc);
        const freshState = freshDoc.exists ? freshDoc.data() as GateCoordination : null;
        
        if (!freshState) {
          throw new Error('Coordination document not found');
        }

        // ATOMICKÁ KONTROLA: Je stále nikdo aktivní?
        if (!freshState.activeUser) {
          // ✅ Atomicky nastav activeUser na tohoto uživatele
          const updatedState: GateCoordination = {
            ...freshState,
            activeUser: user,
            lastActivity: Date.now()
          };
          
          transaction.set(this.coordinationDoc, updatedState);
          return 'GRANTED'; // Úspěch - tento uživatel získal kontrolu
        } else {
          // ❌ Mezitím někdo jiný získal kontrolu
          return 'DENIED_RACE_CONDITION';
        }
      });

      if (transactionResult === 'GRANTED') {
        console.log('🔧 GateCoordinationService: Uživatel', userDisplayName, 'začal ovládat bránu (atomicky)');
        return 'GRANTED';
      }
      
      // Pokud atomická transakce selhala (někdo jiný získal kontrolu), 
      // načti nový stav a zařaď tohoto uživatele do fronty
      console.log('🔧 GateCoordinationService: Race condition - načítám nový stav pro frontu');
      
      const freshState = await this.getCurrentState();
      if (!freshState) {
        return 'DENIED';
      }

      // Pokud už někdo aktivně ovládá a není to tento uživatel, jdi do fronty  
      if (freshState.activeUser && freshState.activeUser.userId !== userId) {
        console.log('🔧 GateCoordinationService: Uživatel', userDisplayName, 'přidán do fronty - aktivní je', freshState.activeUser.userDisplayName);
        
        // Přidej do fronty pomocí addReservation
        const queueSuccess = await this.addReservation(userId, userDisplayName, email);
        return queueSuccess ? 'QUEUED' : 'DENIED';
      }

      // Stejný uživatel - obnov session (už ovládá)
      if (freshState.activeUser && freshState.activeUser.userId === userId) {
        const updatedState: GateCoordination = {
          ...freshState,
          activeUser: { ...user, sessionId: this.currentSessionId },
          lastActivity: Date.now()
        };
        await this.coordinationDoc.set(updatedState);
        return 'GRANTED';
      }

      // Fallback
      return 'DENIED';

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

  // NOVÁ LOGIKA: Aktualizace stavu brány s automatickým otevřením
  async updateGateState(newState: 'CLOSED' | 'OPENING' | 'OPEN' | 'CLOSING' | 'STOPPED'): Promise<void> {
    try {
      const currentState = await this.getCurrentState();
      if (!currentState) return;

      // NOVÉ: Automatické otevření při "CLOSING" (Zavírá se...) pokud někdo čeká
      if (newState === 'CLOSING' && currentState.reservationQueue.length > 0) {
        console.log('🚪 AUTO-OPEN: Brána se zavírá ale někdo čeká - triggering auto open');
        
        // Trigger callback pro automatické otevření
        if (this.onAutoOpenTrigger) {
          const nextUser = currentState.reservationQueue[0];
          this.onAutoOpenTrigger(nextUser.userId);
        }
      }

      // OPRAVENÁ LOGIKA: Při zavření brány uvolni všechny uživatele
      if (newState === 'CLOSED' && currentState.gateState !== 'CLOSED') {
        // Když se brána zavře, vymaž activeUser a frontu - všichni mohou ovládat přímo
        const updatedState: GateCoordination = {
          ...currentState,
          gateState: newState,
          activeUser: null, // OPRAVA: Uvolni kontrolu místo předávání
          reservationQueue: [], // OPRAVA: Vyčisti frontu - všichni mohou ovládat přímo
          lastActivity: Date.now()
        };
        
        await this.coordinationDoc.set(updatedState);
        console.log('🔄 GATE CLOSED: Kontrola uvolněna - všichni uživatelé mohou ovládat přímo');
      } else {
        // Jen aktualizuj stav bez změny kontroly
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

  // NOVÉ WORKFLOW HELPER FUNKCE PRO POŽADOVANOU LOGIKU

  // Může uživatel zavřít bránu normálním tlačítkem?
  canUserCloseGateNormally(userId: string, state: GateCoordination): boolean {
    const result = (state.activeUser?.userId === userId && state.reservationQueue.length === 0) ||
                   (state.activeUser === null);
    
    console.log('🔧 WORKFLOW DEBUG: canUserCloseGateNormally', {
      userId,
      activeUserId: state.activeUser?.userId,
      queueLength: state.reservationQueue.length,
      result,
      timestamp: new Date().toISOString(),
      sessionId: this.currentSessionId
    });
    
    return result;
  }

  // Musí uživatel použít slider pro zavření?
  mustUseSliderToClose(userId: string, state: GateCoordination): boolean {
    const result = state.activeUser?.userId === userId && state.reservationQueue.length > 0;
    
    console.log('🔧 WORKFLOW DEBUG: mustUseSliderToClose', {
      userId,
      activeUserId: state.activeUser?.userId,
      queueLength: state.reservationQueue.length,
      queueUsers: state.reservationQueue.map(u => u.userDisplayName),
      result,
      timestamp: new Date().toISOString(),
      sessionId: this.currentSessionId
    });
    
    return result;
  }

  // Zobrazit upozornění o frontě?
  shouldShowQueueWarning(userId: string, state: GateCoordination): boolean {
    const result = state.activeUser?.userId === userId && state.reservationQueue.length > 0;
    
    console.log('🔧 WORKFLOW DEBUG: shouldShowQueueWarning', {
      userId,
      activeUserId: state.activeUser?.userId,
      queueLength: state.reservationQueue.length,
      nextUserInQueue: state.reservationQueue[0]?.userDisplayName,
      result,
      timestamp: new Date().toISOString(),
      sessionId: this.currentSessionId
    });
    
    return result;
  }

  // DEBUGGING UTILITY - získej debug info o aktuálním stavu
  getDebugInfo(userId: string, state: GateCoordination): any {
    return {
      timestamp: new Date().toISOString(),
      sessionId: this.currentSessionId,
      currentUser: {
        id: userId,
        position: this.getUserPosition(userId, state),
        isActive: state.activeUser?.userId === userId,
        isInQueue: state.reservationQueue.some(u => u.userId === userId),
        canCloseNormally: this.canUserCloseGateNormally(userId, state),
        mustUseSlider: this.mustUseSliderToClose(userId, state),
        shouldShowWarning: this.shouldShowQueueWarning(userId, state)
      },
      gateState: {
        state: state.gateState,
        activeUser: state.activeUser ? {
          id: state.activeUser.userId,
          displayName: state.activeUser.userDisplayName,
          email: state.activeUser.email,
          state: state.activeUser.state
        } : null,
        queue: state.reservationQueue.map((u, index) => ({
          position: index + 1,
          id: u.userId,
          displayName: u.userDisplayName,
          email: u.email,
          state: u.state,
          waitingTime: Date.now() - u.timestamp
        })),
        totalUsers: (state.activeUser ? 1 : 0) + state.reservationQueue.length
      }
    };
  }

  // OPRAVENÁ LOGIKA: Uživatel je blokován když někdo ovládá NEBO se brána pohybuje
  isUserBlocked(userId: string, state: GateCoordination): boolean {
    // Blokován pokud:
    // 1. Někdo je aktivní (activeUser existuje) NEBO
    // 2. Brána se pohybuje (OPENING/CLOSING) - brána byla právě ovládána
    if (state.activeUser !== null && state.activeUser.userId !== userId) {
      return true; // Někdo jiný aktivně ovládá
    }
    
    // NOVÉ: Blokován také když se brána pohybuje (někdo právě ovládal)
    if (state.gateState === 'OPENING' || state.gateState === 'CLOSING') {
      return true; // Brána se pohybuje - čekej až se zastaví
    }
    
    return false;
  }
  
  // OPRAVENÁ LOGIKA: Může uživatel začít ovládat?
  canUserStartControl(userId: string, state: GateCoordination): boolean {
    // Může začít ovládat když:
    // 1. Nikdo není aktivní A brána se nepohybuje NEBO
    // 2. On už je aktivní
    if (state.activeUser?.userId === userId) {
      return true; // Už je aktivní
    }
    
    // NOVÉ: Nemůže ovládat když se brána pohybuje (někdo právě ovládal)
    if (state.gateState === 'OPENING' || state.gateState === 'CLOSING') {
      return false; // Brána se pohybuje - čekej až se zastaví
    }
    
    return state.activeUser === null; // Může ovládat jen když nikdo není aktivní
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
    return this.cleanupStaleData(timeoutMs); // OPRAVA: Předej parametr
  }

  // Vyčištění starých sessionů (cron job)
  async cleanupStaleData(timeoutMs?: number): Promise<void> {
    try {
      const currentState = await this.getCurrentState();
      if (!currentState) return;

      const now = Date.now();
      const TIMEOUT_MS = timeoutMs || (5 * 60 * 1000); // OPRAVA: Použij parametr nebo default 5 min
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