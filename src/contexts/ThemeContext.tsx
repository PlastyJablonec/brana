import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { settingsService } from '../services/settingsService';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [theme, setTheme] = useState<Theme>(() => {
    // Load theme from localStorage or default to light
    const savedTheme = localStorage.getItem('app-theme') as Theme;
    return savedTheme || 'light';
  });

  // Load user's theme from DB when user logs in
  useEffect(() => {
    const loadUserTheme = async () => {
      if (currentUser?.id) {
        try {
          console.log('🔧 ThemeContext: Loading user theme from DB...');
          const userSettings = await settingsService.getUserSettings(currentUser.id);
          if (userSettings.theme !== theme) {
            console.log('🔧 ThemeContext: Setting theme from DB:', userSettings.theme);
            setTheme(userSettings.theme);
            localStorage.setItem('app-theme', userSettings.theme);
          }
        } catch (error) {
          console.error('🔧 ThemeContext: Error loading user theme:', error);
        }
      }
    };

    loadUserTheme();
  }, [currentUser?.id]);

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('app-theme', newTheme);
    
    // Save to DB if user is logged in
    if (currentUser?.id) {
      try {
        console.log('🔧 ThemeContext: Saving theme to DB:', newTheme);
        await settingsService.updateUserTheme(currentUser.id, newTheme);
      } catch (error) {
        console.error('🔧 ThemeContext: Error saving theme to DB:', error);
      }
    }
  };

  // Apply theme to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const value = {
    theme,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};