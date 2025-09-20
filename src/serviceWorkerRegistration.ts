// Empty serviceWorkerRegistration.ts to fix ChunkLoadError
// This file was missing and causing webpack chunk loading errors

export function register() {
  // Service worker registration is handled directly in index.tsx
  console.log('📱 Service worker registration handled in index.tsx');
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error(error.message);
      });
  }
}