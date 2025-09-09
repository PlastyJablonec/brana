import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { updateService } from './services/updateService';

// 🔇 RYCHLÁ OPRAVA KONZOLE - vypnutí debug logů v produkci
if (process.env.NODE_ENV === 'production' || window.location.href.includes('vercel.app')) {
  const originalConsoleLog = console.log;
  console.log = (...args: any[]) => {
    // Zachovat důležité logy (začínají emoji nebo obsahují ERROR/WARN)
    const message = args[0];
    if (typeof message === 'string' && (
      message.includes('ERROR') || 
      message.includes('WARN') || 
      message.includes('❌') || 
      message.includes('⚠️') ||
      message.includes('🔥') ||
      message.startsWith('Firebase Auth:')
    )) {
      originalConsoleLog(...args);
    }
    // Ostatní debug logy potlačit
  };
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Přímá registrace Service Worker bez externího modulu
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;
    
    navigator.serviceWorker
      .register(swUrl)
      .then((registration) => {
        console.log('📱 Service Worker successfully registered');
        // updateService callback dočasně vypnut
        
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  console.log('🆕 New version detected by Service Worker');
                  // Update detection bez updateService
                }
              }
            };
          }
        };
      })
      .catch((error) => {
        console.error('❌ Service Worker registration failed:', error);
      });
  });
}

updateService.init(); // Nyní bezpečně - jen log, žádné chunky

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
