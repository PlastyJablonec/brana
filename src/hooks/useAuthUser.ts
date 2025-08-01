import { useAuth } from '../contexts/AuthContext';

// Simple wrapper hook for consistent auth usage
export function useAuthUser() {
  const auth = useAuth();
  
  return {
    currentUser: auth.currentUser,
    loading: auth.loading,
    login: auth.login,
    logout: auth.logout,
    isAuthenticated: !!auth.currentUser,
  };
}