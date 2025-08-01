import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { mqttService } from '../services/mqttService';

interface GateControlProps {}

const GateControl: React.FC<GateControlProps> = () => {
  const { currentUser } = useAuth();
  const [gateStatus, setGateStatus] = useState('Neznámý stav');
  const [isMoving, setIsMoving] = useState(false);
  const [countdownTimer, setCountdownTimer] = useState('');
  const [stopModeActive, setStopModeActive] = useState(false);
  const [mqttConnected, setMqttConnected] = useState(false);

  useEffect(() => {
    // Connect to MQTT on component mount
    mqttService.connect().catch(error => {
      console.error('Failed to connect to MQTT:', error);
    });

    // Subscribe to status updates
    const unsubscribe = mqttService.onStatusChange((status) => {
      setGateStatus(status.gateStatus);
      setMqttConnected(status.isConnected);
      
      // Update moving state based on status
      const movingStates = ['Otevírá se...', 'Zavírá se...'];
      setIsMoving(movingStates.includes(status.gateStatus));
      
      // Handle auto-close timer for opened gate
      if (status.gateStatus === 'Brána otevřena' && !stopModeActive) {
        startAutoCloseTimer();
      }
      
      // Handle stop mode
      if (status.gateStatus === 'STOP režim') {
        setStopModeActive(true);
        startStopModeTimer();
      } else if (stopModeActive && status.gateStatus !== 'Brána otevřena') {
        setStopModeActive(false);
        setCountdownTimer('');
      }
    });

    return () => {
      unsubscribe();
      mqttService.disconnect();
    };
  }, [stopModeActive]);

  const handleGateControl = async () => {
    if (!currentUser?.permissions.gate) {
      alert('Nemáte oprávnění k ovládání brány');
      return;
    }

    if (!mqttConnected) {
      alert('MQTT není připojen');
      return;
    }

    try {
      await mqttService.publishGateCommand(currentUser.email || '');
    } catch (error) {
      console.error('Failed to send gate command:', error);
      alert('Chyba při odesílání příkazu');
    }
  };

  const handleStopMode = async () => {
    if (!currentUser?.permissions.stopMode) {
      alert('Nemáte oprávnění k STOP režimu');
      return;
    }

    if (!mqttConnected) {
      alert('MQTT není připojen');
      return;
    }

    try {
      await mqttService.publishStopCommand(currentUser.email || '');
    } catch (error) {
      console.error('Failed to send stop command:', error);
      alert('Chyba při odesílání STOP příkazu');
    }
  };

  const startAutoCloseTimer = () => {
    let duration = 240; // 4 minutes
    const interval = setInterval(() => {
      if (duration <= 0) {
        clearInterval(interval);
        setCountdownTimer('');
        return;
      }
      duration--;
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;
      setCountdownTimer(`Auto-zavření za ${minutes}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);
  };

  const startStopModeTimer = () => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      if (minutes > 0) {
        setCountdownTimer(`Otevřeno ${minutes}:${seconds.toString().padStart(2, '0')}`);
      } else {
        setCountdownTimer(`Otevřeno ${seconds}s`);
      }
    }, 1000);
  };

  const getStatusColor = () => {
    if (isMoving) return 'text-gate-warning animate-pulse';
    if (gateStatus === 'Brána otevřena') return 'text-gate-success';
    if (gateStatus === 'Brána zavřena') return 'text-gate-error';
    return 'text-gray-300';
  };

  const getCountdownColor = () => {
    if (stopModeActive) return 'text-gate-success';
    return 'text-gate-warning animate-pulse';
  };

  return (
    <div className="space-y-6">
      {/* Main Gate Button */}
      <div className="flex flex-col items-center">
        <button
          onClick={handleGateControl}
          disabled={!currentUser?.permissions.gate}
          className={`
            w-40 h-40 rounded-full border-4 border-gray-600 bg-gate-card 
            flex flex-col items-center justify-center transition-all duration-200
            ${isMoving ? 'animate-pulse' : 'hover:scale-105 hover:shadow-lg'}
            ${!currentUser?.permissions.gate ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <span className={`text-lg font-bold ${getStatusColor()}`}>
            {gateStatus}
          </span>
          {countdownTimer && (
            <div className={`text-sm mt-2 font-medium ${getCountdownColor()}`}>
              {countdownTimer}
            </div>
          )}
        </button>
      </div>

      {/* STOP Mode Button */}
      {currentUser?.permissions.stopMode && (
        <div className="flex justify-center">
          <button
            onClick={handleStopMode}
            className="bg-gate-warning hover:bg-yellow-500 text-gray-900 font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
          >
            STOP - Zůstat otevřená
          </button>
        </div>
      )}

      {/* Status Info */}
      <div className="text-center text-sm text-gray-400 space-y-1">
        <p>Stav: <span className={getStatusColor()}>{gateStatus}</span></p>
        {isMoving && <p className="animate-pulse">Pohyb detekován...</p>}
        <div className="flex items-center justify-center gap-2">
          <div className={`w-2 h-2 rounded-full ${mqttConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className={mqttConnected ? 'text-green-400' : 'text-red-400'}>
            MQTT {mqttConnected ? 'Připojen' : 'Odpojen'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default GateControl;