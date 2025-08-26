#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 LOG MONITOR - Automatické sledování browser-console.log');
console.log('===============================================');

const logFile = path.join(__dirname, 'browser-console.log');
let lastSize = 0;

// Zkontroluj současný stav
if (fs.existsSync(logFile)) {
  const stats = fs.statSync(logFile);
  lastSize = stats.size;
  console.log(`📁 Log soubor existuje, velikost: ${lastSize} bytů`);
  
  // Ukáž posledních 50 řádků
  console.log('\n📄 POSLEDNÍCH 50 ŘÁDKŮ:');
  console.log('------------------------');
  const content = fs.readFileSync(logFile, 'utf8');
  const lines = content.split('\n');
  const recentLines = lines.slice(-50).filter(line => line.trim());
  recentLines.forEach((line, index) => {
    const lineNum = lines.length - 50 + index;
    console.log(`${String(lineNum).padStart(4)}: ${line}`);
  });
} else {
  console.log('❌ Log soubor neexistuje!');
}

// Sleduj změny
console.log('\n🔄 Spouštím sledování změn...');
console.log('(Ctrl+C pro ukončení)');

setInterval(() => {
  if (fs.existsSync(logFile)) {
    const stats = fs.statSync(logFile);
    if (stats.size !== lastSize) {
      console.log(`\n🆕 NOVÝ OBSAH (${new Date().toLocaleTimeString()}):`);
      console.log('----------------------------------------');
      
      const content = fs.readFileSync(logFile, 'utf8');
      const newContent = content.substring(lastSize);
      console.log(newContent);
      
      lastSize = stats.size;
      
      // Kontrola debug logů
      if (newContent.includes('🚨 DEBUG:')) {
        console.log('✅ NALEZENY DEBUG LOGY - koordinace funguje!');
      }
      if (newContent.includes('GateCoordinationService')) {
        console.log('✅ NALEZENA KOORDINACE SLUŽBA!');
      }
    }
  }
}, 2000); // Každé 2 sekundy

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Log monitor ukončen');
  process.exit(0);
});