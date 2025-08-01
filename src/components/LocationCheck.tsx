import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface LocationCheckProps {}

const LocationCheck: React.FC<LocationCheckProps> = () => {
  const { currentUser } = useAuth();
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isWithinRange, setIsWithinRange] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Allowed location (example coordinates - replace with actual gate location)
  const GATE_LOCATION = { lat: 50.0755, lng: 14.4378 }; // Prague example
  const ALLOWED_RADIUS = 100; // meters

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  const checkLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('GPS lokalizace není dostupná v tomto prohlížeči');
      return;
    }

    setIsLoading(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        
        setLocation(userLocation);
        
        const distance = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          GATE_LOCATION.lat,
          GATE_LOCATION.lng
        );
        
        setIsWithinRange(distance <= ALLOWED_RADIUS);
        setIsLoading(false);
      },
      (error) => {
        setIsLoading(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError('Přístup k poloze byl zamítnut');
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError('Poloha není dostupná');
            break;
          case error.TIMEOUT:
            setLocationError('Timeout při získávání polohy');
            break;
          default:
            setLocationError('Neznámá chyba při získávání polohy');
            break;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

  // Auto-check location on mount
  useEffect(() => {
    if (currentUser?.permissions.requireLocation) {
      checkLocation();
    }
  }, [currentUser]);

  if (!currentUser?.permissions.requireLocation) {
    return null; // Don't show if location check is not required
  }

  return (
    <div className="space-y-4">
      <div className="bg-gate-card p-4 rounded-lg border border-gray-600">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-white">GPS Lokalizace</h3>
          <button
            onClick={checkLocation}
            disabled={isLoading}
            className="text-gate-accent hover:text-blue-400 transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-gray-300">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gate-accent"></div>
            <span className="text-sm">Získávání polohy...</span>
          </div>
        )}

        {locationError && (
          <div className="flex items-center gap-2 text-gate-error">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm">{locationError}</span>
          </div>
        )}

        {location && !isLoading && (
          <div className="space-y-2">
            <div className={`flex items-center gap-2 ${isWithinRange ? 'text-gate-success' : 'text-gate-error'}`}>
              <div className={`w-2 h-2 rounded-full ${isWithinRange ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm font-medium">
                {isWithinRange ? 'V povolené oblasti' : 'Mimo povolenou oblast'}
              </span>
            </div>
            
            <div className="text-xs text-gray-400 space-y-1">
              <p>Lat: {location.lat.toFixed(6)}</p>
              <p>Lng: {location.lng.toFixed(6)}</p>
              {isWithinRange !== null && (
                <p>
                  Vzdálenost: {Math.round(calculateDistance(
                    location.lat, location.lng, GATE_LOCATION.lat, GATE_LOCATION.lng
                  ))}m
                </p>
              )}
            </div>
          </div>
        )}

        {!isWithinRange && location && (
          <div className="mt-3 p-3 bg-gate-error bg-opacity-20 rounded border border-red-500">
            <p className="text-sm text-gate-error">
              ⚠️ Ovládání brány je omezeno na povolenou oblast
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LocationCheck;