import { useState, useEffect } from 'react';
import { ICoordinates } from '../types';

interface ILocationPermissionState {
  hasPermission: boolean | null;
  location: ICoordinates | null;
  error: Error | null;
  isLoading: boolean;
}

export function useLocationPermission(): ILocationPermissionState {
  const [state, setState] = useState<ILocationPermissionState>({
    hasPermission: null,
    location: null,
    error: null,
    isLoading: true,
  });

  useEffect(() => {
    let isMounted = true;

    const checkLocationPermission = async (): Promise<void> => {
      try {
        if (!navigator.geolocation) {
          if (isMounted) {
            setState({
              hasPermission: false,
              location: null,
              error: new Error('Geolocation is not supported by this browser'),
              isLoading: false,
            });
          }
          return;
        }

        // Try to get current position
        navigator.geolocation.getCurrentPosition(
          (position) => {
            if (isMounted) {
              setState({
                hasPermission: true,
                location: {
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                },
                error: null,
                isLoading: false,
              });
            }
          },
          (error) => {
            if (isMounted) {
              let errorMessage = 'Location access denied';
              
              switch (error.code) {
                case error.PERMISSION_DENIED:
                  errorMessage = 'Location access denied by user';
                  break;
                case error.POSITION_UNAVAILABLE:
                  errorMessage = 'Location information unavailable';
                  break;
                case error.TIMEOUT:
                  errorMessage = 'Location request timed out';
                  break;
                default:
                  errorMessage = 'Unknown location error';
                  break;
              }

              setState({
                hasPermission: false,
                location: null,
                error: new Error(errorMessage),
                isLoading: false,
              });
            }
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000,
          }
        );
      } catch (error) {
        if (isMounted) {
          setState({
            hasPermission: false,
            location: null,
            error: error instanceof Error ? error : new Error('Location check failed'),
            isLoading: false,
          });
        }
      }
    };

    checkLocationPermission();

    return () => {
      isMounted = false;
    };
  }, []);

  return state;
}