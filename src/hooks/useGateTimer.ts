import { useState, useEffect, useRef } from 'react';
import { settingsService } from '../services/settingsService';

interface GateTimerState {
  countdown: number;
  displayText: string;
  isActive: boolean;
  type: 'travel' | 'autoClose' | null;
}

export const useGateTimer = () => {
  const [timerState, setTimerState] = useState<GateTimerState>({
    countdown: 0,
    displayText: '',
    isActive: false,
    type: null
  });
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const settingsRef = useRef({ travelTime: 31, autoCloseTime: 240 });

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await settingsService.getAppSettings();
        settingsRef.current = {
          travelTime: settings.gate.travelTime,
          autoCloseTime: settings.gate.autoCloseTime
        };
      } catch (error) {
        console.error('Failed to load timer settings:', error);
      }
    };
    loadSettings();
  }, []);

  const stopTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setTimerState({
      countdown: 0,
      displayText: '',
      isActive: false,
      type: null
    });
  };

  const startTravelTimer = () => {
    stopTimer();
    
    let duration = settingsRef.current.travelTime;
    setTimerState({
      countdown: duration,
      displayText: `Čas pohybu: ~${duration}s`,
      isActive: true,
      type: 'travel'
    });

    intervalRef.current = setInterval(() => {
      duration--;
      
      if (duration <= 0) {
        setTimerState({
          countdown: 0,
          displayText: 'Čekání na finální stav...',
          isActive: true,
          type: 'travel'
        });
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return;
      }

      setTimerState({
        countdown: duration,
        displayText: `Čas pohybu: ~${duration}s`,
        isActive: true,
        type: 'travel'
      });
    }, 1000);
  };

  const startAutoCloseTimer = () => {
    stopTimer();
    
    let duration = settingsRef.current.autoCloseTime;
    const formatTime = (seconds: number) => {
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    setTimerState({
      countdown: duration,
      displayText: `Auto-zavření za ${formatTime(duration)}`,
      isActive: true,
      type: 'autoClose'
    });

    intervalRef.current = setInterval(() => {
      duration--;
      
      if (duration <= 0) {
        stopTimer();
        return;
      }

      setTimerState({
        countdown: duration,
        displayText: `Auto-zavření za ${formatTime(duration)}`,
        isActive: true,
        type: 'autoClose'
      });
    }, 1000);
  };

  const startOpenElapsedTimer = () => {
    stopTimer();
    
    let elapsed = 0;
    const formatTime = (seconds: number) => {
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      if (minutes > 0) {
        return `Otevřeno ${minutes}:${secs.toString().padStart(2, '0')}`;
      } else {
        return `Otevřeno ${secs}s`;
      }
    };

    setTimerState({
      countdown: elapsed,
      displayText: formatTime(elapsed),
      isActive: true,
      type: 'autoClose'
    });

    intervalRef.current = setInterval(() => {
      elapsed++;
      setTimerState({
        countdown: elapsed,
        displayText: formatTime(elapsed),
        isActive: true,
        type: 'autoClose'
      });
    }, 1000);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    timerState,
    startTravelTimer,
    startAutoCloseTimer,
    startOpenElapsedTimer,
    stopTimer
  };
};