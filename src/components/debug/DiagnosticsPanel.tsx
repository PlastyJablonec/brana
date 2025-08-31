import React, { useState, useEffect } from 'react';
import { diagnosticsService } from '../../services/diagnosticsService';

interface DiagnosticsResult {
  timestamp: string;
  firestore: any;
  geolocation: any;
  mqtt: any;
  browser: any;
  network: any;
}

const DiagnosticsPanel: React.FC<{ 
  isVisible: boolean;
  onClose: () => void;
}> = ({ isVisible, onClose }) => {
  const [diagnostics, setDiagnostics] = useState<DiagnosticsResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [debugMode, setDebugMode] = useState(diagnosticsService.isDebugMode());

  useEffect(() => {
    if (isVisible && !diagnostics) {
      runDiagnostics();
    }
  }, [isVisible]);

  const runDiagnostics = async () => {
    setIsRunning(true);
    try {
      const result = await diagnosticsService.runCompleteDiagnostics();
      setDiagnostics(result);
    } catch (error) {
      console.error('Diagnostika selhala:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const toggleDebugMode = () => {
    const newMode = !debugMode;
    setDebugMode(newMode);
    diagnosticsService.setDebugMode(newMode);
  };

  const exportDiagnostics = async () => {
    try {
      const data = await diagnosticsService.exportDiagnostics();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gate-diagnostics-${new Date().toISOString().slice(0, 19)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export selhal:', error);
    }
  };

  const getStatusIcon = (isOk: boolean) => {
    return isOk ? '✅' : '❌';
  };

  const getStatusClass = (isOk: boolean) => {
    return isOk ? 'text-green-600' : 'text-red-600';
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-y-auto p-6 w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">🔍 Diagnostika Systému</h2>
          <div className="flex gap-2">
            <button
              onClick={toggleDebugMode}
              className={`px-3 py-1 rounded text-sm font-medium ${
                debugMode 
                  ? 'bg-orange-100 text-orange-800 border border-orange-200'
                  : 'bg-gray-100 text-gray-800 border border-gray-200'
              }`}
            >
              Debug {debugMode ? 'ZAP' : 'VYP'}
            </button>
            <button
              onClick={exportDiagnostics}
              className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium border border-blue-200"
              disabled={!diagnostics}
            >
              📤 Export
            </button>
            <button
              onClick={runDiagnostics}
              className="px-3 py-1 bg-green-100 text-green-800 rounded text-sm font-medium border border-green-200"
              disabled={isRunning}
            >
              {isRunning ? '🔄 Běží...' : '🔍 Spustit'}
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1 bg-gray-100 text-gray-800 rounded text-sm font-medium border border-gray-200"
            >
              ✕
            </button>
          </div>
        </div>

        {isRunning && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Spouštím diagnostiku...</p>
          </div>
        )}

        {diagnostics && (
          <div className="space-y-6">
            {/* Firestore */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                {getStatusIcon(diagnostics.firestore.connected)}
                Firebase/Firestore
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-medium">Status:</span>
                  <span className={`ml-2 ${getStatusClass(diagnostics.firestore.connected)}`}>
                    {diagnostics.firestore.connected ? 'Připojeno' : 'Nepřipojeno'}
                  </span>
                </div>
                {diagnostics.firestore.latency && (
                  <div>
                    <span className="font-medium">Latence:</span>
                    <span className="ml-2">{diagnostics.firestore.latency}ms</span>
                  </div>
                )}
                {diagnostics.firestore.error && (
                  <div className="col-span-2">
                    <span className="font-medium text-red-600">Chyba:</span>
                    <span className="ml-2 text-red-600 text-sm">{diagnostics.firestore.error}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Geolokace */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                {getStatusIcon(diagnostics.geolocation.browserSupport && diagnostics.geolocation.permissionStatus === 'granted')}
                Geolokace
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-medium">Podpora prohlížeče:</span>
                  <span className={`ml-2 ${getStatusClass(diagnostics.geolocation.browserSupport)}`}>
                    {diagnostics.geolocation.browserSupport ? 'Ano' : 'Ne'}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Oprávnění:</span>
                  <span className={`ml-2 ${getStatusClass(diagnostics.geolocation.permissionStatus === 'granted')}`}>
                    {diagnostics.geolocation.permissionStatus}
                  </span>
                </div>
                {diagnostics.geolocation.lastKnownAccuracy && (
                  <div>
                    <span className="font-medium">Přesnost:</span>
                    <span className="ml-2">±{Math.round(diagnostics.geolocation.lastKnownAccuracy)}m</span>
                  </div>
                )}
                {diagnostics.geolocation.error && (
                  <div className="col-span-2">
                    <span className="font-medium text-red-600">Chyba:</span>
                    <span className="ml-2 text-red-600 text-sm">{diagnostics.geolocation.error}</span>
                  </div>
                )}
              </div>
            </div>

            {/* MQTT */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                {getStatusIcon(diagnostics.mqtt.connected)}
                MQTT
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-medium">Status:</span>
                  <span className={`ml-2 ${getStatusClass(diagnostics.mqtt.connected)}`}>
                    {diagnostics.mqtt.connected ? 'Připojeno' : 'Nepřipojeno'}
                  </span>
                </div>
                {diagnostics.mqtt.latency && (
                  <div>
                    <span className="font-medium">Latence:</span>
                    <span className="ml-2">{diagnostics.mqtt.latency}ms</span>
                  </div>
                )}
                {diagnostics.mqtt.error && (
                  <div className="col-span-2">
                    <span className="font-medium text-red-600">Chyba:</span>
                    <span className="ml-2 text-red-600 text-sm">{diagnostics.mqtt.error}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Prohlížeč */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                {getStatusIcon(diagnostics.browser.isSecureContext && diagnostics.browser.cookiesEnabled)}
                Prohlížeč
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">HTTPS:</span>
                  <span className={`ml-2 ${getStatusClass(diagnostics.browser.isSecureContext)}`}>
                    {diagnostics.browser.isSecureContext ? 'Ano' : 'Ne'}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Cookies:</span>
                  <span className={`ml-2 ${getStatusClass(diagnostics.browser.cookiesEnabled)}`}>
                    {diagnostics.browser.cookiesEnabled ? 'Zapnuty' : 'Vypnuty'}
                  </span>
                </div>
                <div>
                  <span className="font-medium">LocalStorage:</span>
                  <span className={`ml-2 ${getStatusClass(diagnostics.browser.localStorageAvailable)}`}>
                    {diagnostics.browser.localStorageAvailable ? 'Dostupný' : 'Nedostupný'}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Online:</span>
                  <span className={`ml-2 ${getStatusClass(diagnostics.network.online)}`}>
                    {diagnostics.network.online ? 'Ano' : 'Ne'}
                  </span>
                </div>
                {diagnostics.network.effectiveType && (
                  <div className="col-span-2">
                    <span className="font-medium">Typ připojení:</span>
                    <span className="ml-2">{diagnostics.network.effectiveType} ({diagnostics.network.connectionType})</span>
                  </div>
                )}
              </div>
            </div>

            <div className="text-xs text-gray-500 text-center">
              Diagnostika z {new Date(diagnostics.timestamp).toLocaleString()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DiagnosticsPanel;