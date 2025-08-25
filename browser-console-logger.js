// Browser Console Logger - zachytává console logy a posílá na server
// Spuštění: Vlož tento kód do browser console

console.log('🔧 Starting Console Logger...');

// Server endpoint pro odesílání logů
const LOG_SERVER_URL = 'http://localhost:3004/api/logs';

// Původní console metody
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;
const originalInfo = console.info;

// Array pro ukládání logů
let logBuffer = [];

// Funkce pro odeslání logů na server
async function sendLogsToServer() {
  if (logBuffer.length === 0) return;
  
  try {
    await fetch(LOG_SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        logs: logBuffer,
        timestamp: new Date().toISOString(),
        url: window.location.href
      })
    });
    
    logBuffer = []; // Vymaž buffer po odeslání
  } catch (error) {
    // Neloguj chybu do console aby nevznikl loop
  }
}

// Helper funkce pro zachycení argumentů
function formatLogArgs(args) {
  return Array.from(args).map(arg => {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg, null, 2);
      } catch (e) {
        return '[Circular Object]';
      }
    }
    return String(arg);
  }).join(' ');
}

// Přepis console.log
console.log = function(...args) {
  const logMessage = formatLogArgs(args);
  logBuffer.push({
    type: 'log',
    message: logMessage,
    timestamp: new Date().toISOString()
  });
  
  originalLog.apply(console, args);
};

// Přepis console.error
console.error = function(...args) {
  const logMessage = formatLogArgs(args);
  logBuffer.push({
    type: 'error', 
    message: logMessage,
    timestamp: new Date().toISOString()
  });
  
  originalError.apply(console, args);
};

// Přepis console.warn
console.warn = function(...args) {
  const logMessage = formatLogArgs(args);
  logBuffer.push({
    type: 'warn',
    message: logMessage, 
    timestamp: new Date().toISOString()
  });
  
  originalWarn.apply(console, args);
};

// Přepis console.info
console.info = function(...args) {
  const logMessage = formatLogArgs(args);
  logBuffer.push({
    type: 'info',
    message: logMessage,
    timestamp: new Date().toISOString()
  });
  
  originalInfo.apply(console, args);
};

// Posílej logy každé 2 sekundy
const logInterval = setInterval(sendLogsToServer, 2000);

// Zachyť i chyby stránky
window.addEventListener('error', function(event) {
  logBuffer.push({
    type: 'error',
    message: `Uncaught Error: ${event.error?.message || event.message} at ${event.filename}:${event.lineno}`,
    timestamp: new Date().toISOString()
  });
});

console.log('✅ Console Logger aktivní! Logy se posílají na localhost:3004');
console.log('🔧 Pro zastavení: clearInterval(' + logInterval + ')');

// Export pro manuální kontrolu
window.consoleLogger = {
  stop: () => clearInterval(logInterval),
  sendNow: sendLogsToServer,
  buffer: logBuffer
};