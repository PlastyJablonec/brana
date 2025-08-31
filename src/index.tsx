import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { updateService } from './services/updateService';

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
