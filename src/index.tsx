import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { updateService } from './services/updateService';

// 🔇 NOUZOVÁ OPRAVA KONZOLE - VYPNUTÍ VŠECH DEBUG LOGŮ!
// const originalConsoleLog = console.log;
// const originalConsoleDebug = console.debug;
// const originalConsoleInfo = console.info;

// TOTÁLNÍ VYPNUTÍ VŠECH LOGŮ - jen kritické chyby!
console.log = () => {}; // Úplně vypnout
console.debug = () => {}; // Vypnout debug
console.info = () => {}; // Vypnout info

// Pouze console.error a console.warn zůstávají aktivní pro kritické problémy

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
    if (process.env.NODE_ENV == 'production') {
      const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;
      navigator.serviceWorker.register(swUrl).then((registration)=>{
        console.log('📱 Service Worker successfully registered');
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  console.log('🆕 New version detected by Service Worker');
                }
              }
            };
          }
        };
      }).catch((error)=>{
        console.error('❌ Service Worker registration failed:', error);
      });
    } else {
      navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister())).catch(()=>{});
    }
  });
}

if (process.env.NODE_ENV == 'production') {
  updateService.init();
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
// Trigger Vercel deployment
