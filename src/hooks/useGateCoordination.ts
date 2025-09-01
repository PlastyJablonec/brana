import { useState, useEffect, useCallback } from 'react';
import { gateCoordinationService, GateCoordination } from '../services/gateCoordinationService';
import { useAuth } from '../contexts/AuthContext';

export interface GateCoordinationStatus {
  isActive: boolean;          // Je uživatel aktivní (může ovládat)
  isInQueue: boolean;         // Je uživatel v rezervační frontě
  position: number;           // Pozice ve frontě (0 = aktivní, -1 = není zaregistrovaný)
  canControl: boolean;        // Může uživatel ovládat bránu
  canStartControl: boolean;   // NOVÉ: Může začít ovládat (když nikdo není aktivní)
  isBlocked: boolean;         // Jsou tlačítka zablokována kvůli jinému uživateli
  activeUser: string | null;  // Kdo právě ovládá bránu (displayName)
  queueLength: number;        // Počet čekajících v queue
  waitingTimeText: string;    // Text pro UI ("Aktivní", "Další na řadě", "3. v pořadí")
  connectedUsers: number;     // NOVÉ: Počet připojených uživatelů (informační)
  
  // NOVÉ WORKFLOW FIELDS PRO POŽADOVANOU LOGIKU
  canCloseNormally: boolean;    // Může zavřít bránu normálním tlačítkem
  mustUseSlider: boolean;       // Musí použít slider pro zavření
  shouldShowQueueWarning: boolean; // Zobrazit upozornění o frontě
  debugInfo?: any;             // Debug informace pro vývojáře
}

export function useGateCoordination() {
  const { currentUser } = useAuth();
  const [coordinationState, setCoordinationState] = useState<GateCoordination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inicializace služby
  useEffect(() => {
    console.log('🚨 DEBUG: useGateCoordination useEffect START - currentUser:', currentUser?.email);
    let isInitialized = false;

    const initializeService = async () => {
      try {
        console.log('🚨 DEBUG: Spouštím gateCoordinationService.initialize()');
        await gateCoordinationService.initialize();
        isInitialized = true;
        setIsLoading(false);
        console.log('✅ useGateCoordination: Služba inicializována ÚSPĚŠNĚ');
        
        // NOVÉ: Spustit heartbeat pro aktuálního uživatele
        if (currentUser) {
          gateCoordinationService.startHeartbeat(
            currentUser.id, 
            currentUser.displayName || currentUser.email || 'Neznámý uživatel'
          );
        }
      } catch (err) {
        setError('Chyba při inicializaci koordinace uživatelů');
        setIsLoading(false);
        console.error('❌ useGateCoordination: Inicializace SELHALA:', err);
      }
    };

    initializeService();

    // Cleanup funkce
    const cleanup = () => {
      if (isInitialized) {
        gateCoordinationService.destroy();
      }
    };

    // KRITICKÁ OPRAVA: Přidání beforeunload listener pro cleanup při zavření tabu/browseru
    const handleBeforeUnload = () => {
      console.log('🔄 useGateCoordination: beforeunload - spouštím cleanup');
      cleanup();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload); // iOS Safari backup

    // Cleanup při unmount komponenty nebo změně currentUser
    return () => {
      cleanup();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, [currentUser?.id]);

  // Registrace callbacků pro real-time změny
  useEffect(() => {
    if (isLoading) return;

    const handleStateChange = (state: GateCoordination) => {
      // NOVÉ: Enhanced logging pro debugging
      const previousState = coordinationState;
      const currentUserId = currentUser?.id;
      
      console.log('🔄 COORDINATION STATE CHANGE:', {
        timestamp: new Date().toISOString(),
        currentUserId,
        previousActiveUser: previousState?.activeUser?.userId || null,
        newActiveUser: state.activeUser?.userId || null,
        activeUserChanged: previousState?.activeUser?.userId !== state.activeUser?.userId,
        previousQueueLength: previousState?.reservationQueue?.length || 0,
        newQueueLength: state.reservationQueue?.length || 0,
        queueChanged: (previousState?.reservationQueue?.length || 0) !== (state.reservationQueue?.length || 0),
        gateState: state.gateState
      });
      
      // NOVÉ: Notify user o významných změnách
      if (currentUserId && previousState?.activeUser?.userId !== state.activeUser?.userId) {
        if (state.activeUser?.userId === currentUserId) {
          console.log('✅ Uživatel získal kontrolu nad bránou');
        } else if (previousState?.activeUser?.userId === currentUserId && !state.activeUser) {
          console.log('❌ Uživatel ztratil kontrolu nad bránou'); 
        }
      }
      
      setCoordinationState(state);
      setError(null);
    };

    const handleUserConflict = (conflictInfo: { activeUser: any, currentUser: string }) => {
      if (currentUser?.id === conflictInfo.currentUser) {
        setError(`Bránu právě ovládá ${conflictInfo.activeUser.userDisplayName}. Můžete se zařadit do fronty.`);
      }
    };

    const handleAutoOpenTrigger = (userId: string) => {
      if (currentUser?.id === userId) {
        console.log('🚪 AUTO-OPEN: Automatické otevření spuštěno pro', currentUser.displayName);
        // Spustit custom event pro Dashboard komponentu
        window.dispatchEvent(new CustomEvent('gate-auto-open', { 
          detail: { userId, userDisplayName: currentUser.displayName }
        }));
      }
    };

    gateCoordinationService.onCoordinationStateChange(handleStateChange);
    gateCoordinationService.onUserConflictDetected(handleUserConflict);
    gateCoordinationService.onAutoOpeningTriggered(handleAutoOpenTrigger);

    // Načti aktuální stav
    gateCoordinationService.getCurrentState().then(state => {
      if (state) {
        setCoordinationState(state);
      }
    });

  }, [isLoading, currentUser]);

  // Vyčíslení statusu pro aktuálního uživatele
  const getCoordinationStatus = useCallback((): GateCoordinationStatus => {
    if (!coordinationState || !currentUser) {
      return {
        isActive: false,
        isInQueue: false,
        position: -1,
        canControl: false,
        canStartControl: false,
        isBlocked: false,
        activeUser: null,
        queueLength: 0,
        waitingTimeText: 'Nepřipojeno',
        connectedUsers: 0,
        canCloseNormally: false,
        mustUseSlider: false,
        shouldShowQueueWarning: false
      };
    }

    const userId = currentUser.id;
    const position = gateCoordinationService.getUserPosition(userId, coordinationState);
    const isBlocked = gateCoordinationService.isUserBlocked(userId, coordinationState);
    const waitingTimeText = gateCoordinationService.getWaitingTime(position);
    
    // NOVÉ: Může uživatel začít ovládat? (když nikdo aktivně neovládá)
    const canStartControl = gateCoordinationService.canUserStartControl(userId, coordinationState);
    
    // NOVÉ: Používej heartbeat systém pro správné počítání všech připojených uživatelů
    const connectedUsers = gateCoordinationService.getConnectedUsersCount(coordinationState);
    
    // NOVÉ WORKFLOW LOGIKY
    const canCloseNormally = gateCoordinationService.canUserCloseGateNormally(userId, coordinationState);
    const mustUseSlider = gateCoordinationService.mustUseSliderToClose(userId, coordinationState);
    const shouldShowQueueWarning = gateCoordinationService.shouldShowQueueWarning(userId, coordinationState);
    
    // Comprehensive debug info
    const debugInfo = gateCoordinationService.getDebugInfo(userId, coordinationState);
    
    console.log('🚨 DEBUG useGateCoordination STATUS (ENHANCED):', {
      currentUserId: userId,
      currentUserEmail: currentUser.email,
      position,
      isBlocked,
      canStartControl,
      connectedUsers,
      connectedUsersData: coordinationState.connectedUsers,
      // NOVÉ DEBUG FIELDS
      canCloseNormally,
      mustUseSlider,
      shouldShowQueueWarning,
      activeUserId: coordinationState.activeUser?.userId,
      activeUserEmail: coordinationState.activeUser?.email,
      activeUserExists: !!coordinationState.activeUser,
      queueLength: coordinationState.reservationQueue.length,
      gateState: coordinationState.gateState,
      timestamp: new Date().toISOString()
    });

    return {
      isActive: position === 0,
      isInQueue: position > 0,
      position,
      canControl: position === 0,
      canStartControl,
      isBlocked,
      activeUser: coordinationState.activeUser?.userDisplayName || null,
      queueLength: coordinationState.reservationQueue.length,
      waitingTimeText,
      connectedUsers,
      
      // NOVÉ WORKFLOW FIELDS
      canCloseNormally,
      mustUseSlider,
      shouldShowQueueWarning,
      debugInfo: process.env.NODE_ENV === 'development' ? debugInfo : undefined
    };
  }, [coordinationState, currentUser]);

  // Funkcionalita pro ovládání
  const requestControl = useCallback(async (): Promise<boolean> => {
    if (!currentUser) {
      setError('Nejste přihlášeni');
      return false;
    }

    try {
      const result = await gateCoordinationService.requestGateControl(
        currentUser.id,
        currentUser.displayName || currentUser.email || 'Neznámý uživatel',
        currentUser.email || ''
      );

      switch (result) {
        case 'GRANTED':
          setError(null);
          return true;
        case 'DENIED':
          setError('Ovládání bylo odmítnuto - někdo jiný již ovládá bránu');
          return false;
        case 'QUEUED':
          setError('Byli jste zařazeni do fronty');
          return false;
        default:
          return false;
      }
    } catch (err) {
      setError('Chyba při žádosti o ovládání');
      console.error('🔧 useGateCoordination: Chyba requestControl:', err);
      return false;
    }
  }, [currentUser]);

  const releaseControl = useCallback(async (): Promise<void> => {
    if (!currentUser) return;

    try {
      await gateCoordinationService.releaseGateControl(currentUser.id);
      setError(null);
    } catch (err) {
      setError('Chyba při uvolňování ovládání');
      console.error('🔧 useGateCoordination: Chyba releaseControl:', err);
    }
  }, [currentUser]);

  const joinQueue = useCallback(async (): Promise<boolean> => {
    if (!currentUser) {
      setError('Nejste přihlášeni');
      return false;
    }

    try {
      const success = await gateCoordinationService.addReservation(
        currentUser.id,
        currentUser.displayName || currentUser.email || 'Neznámý uživatel',
        currentUser.email || ''
      );

      if (success) {
        setError(null);
        return true;
      } else {
        setError('Nepodařilo se zařadit do fronty');
        return false;
      }
    } catch (err) {
      setError('Chyba při řazení do fronty');
      console.error('🔧 useGateCoordination: Chyba joinQueue:', err);
      return false;
    }
  }, [currentUser]);

  const leaveQueue = useCallback(async (): Promise<void> => {
    if (!currentUser) return;

    try {
      await gateCoordinationService.removeReservation(currentUser.id);
      setError(null);
    } catch (err) {
      setError('Chyba při opouštění fronty');
      console.error('🔧 useGateCoordination: Chyba leaveQueue:', err);
    }
  }, [currentUser]);

  // Aktualizace stavu brány (pro integraci s MQTT)
  const updateGateState = useCallback(async (newState: 'CLOSED' | 'OPENING' | 'OPEN' | 'CLOSING' | 'STOPPED'): Promise<void> => {
    try {
      await gateCoordinationService.updateGateState(newState);
    } catch (err) {
      console.error('🔧 useGateCoordination: Chyba updateGateState:', err);
    }
  }, []);

  // Vyčištění neaktivních session (volat periodicky)
  const cleanupSessions = useCallback(async (): Promise<void> => {
    try {
      await gateCoordinationService.cleanupInactiveSessions(1); // OPRAVA: Snížení z 30 minut na 1 minutu
    } catch (err) {
      console.error('🔧 useGateCoordination: Chyba cleanupSessions:', err);
    }
  }, []);

  // NOVÉ: Automatický cleanup každých 30 sekund pro odstranění neaktivních uživatelů
  useEffect(() => {
    if (isLoading) return;

    const cleanupInterval = setInterval(() => {
      cleanupSessions();
    }, 30000); // 30 sekund

    // Cleanup interval při unmount
    return () => {
      clearInterval(cleanupInterval);
    };
  }, [isLoading, cleanupSessions]);

  return {
    // Stav
    coordinationState,
    status: getCoordinationStatus(),
    isLoading,
    error,

    // Akce
    requestControl,
    releaseControl,
    joinQueue,
    leaveQueue,
    updateGateState,
    cleanupSessions,

    // Utility
    clearError: () => setError(null)
  };
}