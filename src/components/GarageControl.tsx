import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { mqttService } from '../services/mqttService';

interface GarageControlProps {}

const GarageControl: React.FC<GarageControlProps> = () => {
  const { currentUser } = useAuth();
  const [garageStatus, setGarageStatus] = useState('Neznámý stav');
  const [isMoving, setIsMoving] = useState(false);
  const [mqttConnected, setMqttConnected] = useState(false);

  useEffect(() => {
    // Subscribe to MQTT status updates
    const unsubscribe = mqttService.onStatusChange((status) => {
      setGarageStatus(status.garageStatus);
      setMqttConnected(status.isConnected);
      
      // Update moving state based on status
      const movingStates = ['Garáž - otevírá se...', 'Garáž - zavírá se...'];
      setIsMoving(movingStates.includes(status.garageStatus));
    });

    return unsubscribe;
  }, []);

  const handleGarageControl = async () => {
    if (!currentUser?.permissions.garage) {
      alert('Nemáte oprávnění k ovládání garáže');
      return;
    }

    if (!mqttConnected) {
      alert('MQTT není připojen');
      return;
    }

    try {
      await mqttService.publishGarageCommand(currentUser.email || '');
    } catch (error) {
      console.error('Failed to send garage command:', error);
      alert('Chyba při odesílání příkazu');
    }
  };

  const getStatusColor = () => {
    if (isMoving) return 'text-gate-warning animate-pulse';
    if (garageStatus === 'Garáž otevřena') return 'text-gate-success';
    if (garageStatus === 'Garáž zavřena') return 'text-gate-error';
    return 'text-gray-300';
  };

  return (
    <div className="space-y-4">
      {/* Garage Button */}
      <div className="flex justify-center">
        <button
          onClick={handleGarageControl}
          disabled={!currentUser?.permissions.garage}
          className={`
            w-32 h-16 rounded-full border-2 border-gray-600 bg-gate-card 
            flex items-center justify-center gap-2 transition-all duration-200
            ${isMoving ? 'animate-pulse' : 'hover:scale-105 hover:shadow-lg'}
            ${!currentUser?.permissions.garage ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          {/* Garage Icon */}
          <svg className="w-6 h-6 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 3L2 9v12h20V9L12 3zm8 16H4v-8l8-5.33L20 11v8zm-2-6v4h-2v-4h2zm-4 0v4h-2v-4h2zm-4 0v4H8v-4h2z"/>
          </svg>
          <span className={`text-sm font-semibold ${getStatusColor()}`}>
            {garageStatus}
          </span>
        </button>
      </div>

      {/* Status Info */}
      <div className="text-center text-sm text-gray-400 space-y-1">
        <p>Stav garáže: <span className={getStatusColor()}>{garageStatus}</span></p>
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

export default GarageControl;