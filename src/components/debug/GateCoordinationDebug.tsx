import React, { useState, useEffect } from 'react';
import { useGateCoordination } from '../../hooks/useGateCoordination';

interface GateCoordinationDebugProps {
  show?: boolean;
}

const GateCoordinationDebug: React.FC<GateCoordinationDebugProps> = ({ show = false }) => {
  const { status, coordinationState, error } = useGateCoordination();
  const [debugHistory, setDebugHistory] = useState<any[]>([]);
  const [showFullDebug, setShowFullDebug] = useState(false);

  // Přidej nový debug záznam při změně statusu
  useEffect(() => {
    if (status.debugInfo) {
      setDebugHistory(prev => {
        const newEntry = {
          id: Date.now(),
          ...status.debugInfo
        };
        
        // Uchovej jen posledních 20 záznamů
        const updated = [newEntry, ...prev].slice(0, 20);
        return updated;
      });
    }
  }, [status]);

  if (!show && process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div className="bg-gray-900 text-white p-4 rounded-lg shadow-lg border border-gray-700">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-bold text-green-400">🔧 Gate Coordination Debug</h3>
          <button
            onClick={() => setShowFullDebug(!showFullDebug)}
            className="text-xs px-2 py-1 bg-blue-600 rounded hover:bg-blue-700"
          >
            {showFullDebug ? 'Minimalizovat' : 'Detail'}
          </button>
        </div>

        {/* Rychlý status přehled */}
        <div className="text-xs space-y-1">
          <div className="flex justify-between">
            <span>Pozice:</span>
            <span className={status.position === 0 ? 'text-green-400' : status.position > 0 ? 'text-yellow-400' : 'text-gray-400'}>
              {status.waitingTimeText}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span>Může zavřít normálně:</span>
            <span className={status.canCloseNormally ? 'text-green-400' : 'text-red-400'}>
              {status.canCloseNormally ? '✅' : '❌'}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span>Musí slider:</span>
            <span className={status.mustUseSlider ? 'text-yellow-400' : 'text-green-400'}>
              {status.mustUseSlider ? '⚠️' : '✅'}
            </span>
          </div>

          <div className="flex justify-between">
            <span>Fronta:</span>
            <span className="text-blue-400">{status.queueLength} čekajících</span>
          </div>

          {status.activeUser && (
            <div className="flex justify-between">
              <span>Aktivní:</span>
              <span className="text-purple-400 truncate max-w-20">{status.activeUser}</span>
            </div>
          )}
        </div>

        {/* Chybové hlášení */}
        {error && (
          <div className="mt-2 p-2 bg-red-900 rounded text-red-300 text-xs">
            {error}
          </div>
        )}

        {/* Podrobný debug (rozbalitelný) */}
        {showFullDebug && (
          <div className="mt-3 border-t border-gray-700 pt-3 max-h-96 overflow-y-auto">
            <h4 className="text-xs font-bold mb-2 text-yellow-400">🔍 Podrobné informace</h4>
            
            {status.debugInfo && (
              <div className="text-xs space-y-2">
                <div>
                  <strong className="text-blue-400">Aktuální stav:</strong>
                  <pre className="bg-gray-800 p-1 rounded mt-1 text-xs overflow-x-auto">
{JSON.stringify(status.debugInfo.currentUser, null, 2)}
                  </pre>
                </div>
                
                <div>
                  <strong className="text-purple-400">Brána:</strong>
                  <pre className="bg-gray-800 p-1 rounded mt-1 text-xs overflow-x-auto">
{JSON.stringify(status.debugInfo.gateState, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Historie změn */}
            {debugHistory.length > 0 && (
              <div className="mt-3">
                <h4 className="text-xs font-bold mb-2 text-green-400">📊 Historie změn</h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {debugHistory.slice(0, 5).map((entry, index) => (
                    <div key={entry.id} className="text-xs bg-gray-800 p-1 rounded">
                      <div className="text-gray-400">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </div>
                      <div className="text-white">
                        Pos: {entry.currentUser?.position}, 
                        Normal: {entry.currentUser?.canCloseNormally ? '✅' : '❌'}, 
                        Slider: {entry.currentUser?.mustUseSlider ? '⚠️' : '✅'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tlačítka pro rychlé akce */}
        <div className="mt-3 flex space-x-2">
          <button
            onClick={() => setDebugHistory([])}
            className="text-xs px-2 py-1 bg-red-600 rounded hover:bg-red-700"
          >
            Vymazat historii
          </button>
          <button
            onClick={() => console.log('FULL DEBUG STATE:', { status, coordinationState })}
            className="text-xs px-2 py-1 bg-green-600 rounded hover:bg-green-700"
          >
            Log do konzole
          </button>
        </div>
      </div>
    </div>
  );
};

export default GateCoordinationDebug;