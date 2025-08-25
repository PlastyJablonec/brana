const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));

// CORS for localhost
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
});

// Log file path
const LOG_FILE = path.join(__dirname, 'browser-console.log');

// Clear log file na začátku
fs.writeFileSync(LOG_FILE, `=== Console Logger Session Started: ${new Date().toISOString()} ===\n`);

app.post('/api/logs', (req, res) => {
  try {
    const { logs, timestamp, url } = req.body;
    
    if (!logs || !Array.isArray(logs)) {
      return res.status(400).json({ error: 'Invalid logs format' });
    }
    
    // Formátuj logy pro soubor
    const formattedLogs = logs.map(log => {
      const time = new Date(log.timestamp).toLocaleTimeString();
      const type = log.type.toUpperCase().padEnd(5);
      return `[${time}] ${type}: ${log.message}`;
    }).join('\n');
    
    if (formattedLogs.trim()) {
      fs.appendFileSync(LOG_FILE, formattedLogs + '\n');
      console.log(`📝 Saved ${logs.length} logs to file`);
    }
    
    res.json({ success: true, received: logs.length });
  } catch (error) {
    console.error('❌ Log server error:', error);
    res.status(500).json({ error: 'Failed to save logs' });
  }
});

// API pro čtení logů
app.get('/api/logs', (req, res) => {
  try {
    const logs = fs.readFileSync(LOG_FILE, 'utf8');
    res.json({ logs });
  } catch (error) {
    res.json({ logs: 'No logs available' });
  }
});

// API pro vymazání logů
app.delete('/api/logs', (req, res) => {
  fs.writeFileSync(LOG_FILE, `=== Console Logger Session Started: ${new Date().toISOString()} ===\n`);
  res.json({ success: true, message: 'Logs cleared' });
});

const PORT = 3004;
app.listen(PORT, () => {
  console.log(`🚀 Console Log Server running on http://localhost:${PORT}`);
  console.log(`📝 Logs will be saved to: ${LOG_FILE}`);
  console.log('');
  console.log('📋 USAGE:');
  console.log('1. Otevři http://localhost:3000 v prohlížeči');
  console.log('2. Stiskni F12 → Console');
  console.log('3. Zkopíruj a vlož browser-console-logger.js kód');
  console.log('4. Refreshni stránku (Ctrl+F5)');
  console.log('5. Claude přečte logy ze souboru automaticky');
});