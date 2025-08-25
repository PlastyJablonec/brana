const puppeteer = require('puppeteer');

(async () => {
  console.log('🚀 Starting browser debug session...');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Listen to console logs
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    
    if (type === 'error') {
      console.log(`🚨 BROWSER ERROR: ${text}`);
    } else if (text.includes('MQTT') || text.includes('connack')) {
      console.log(`📡 MQTT: ${text}`);
    } else if (text.includes('Cannot set properties')) {
      console.log(`⚠️  NULL ERROR: ${text}`);
    }
  });
  
  // Listen to page errors
  page.on('error', err => {
    console.log(`💥 PAGE ERROR: ${err.message}`);
  });
  
  // Listen to unhandled rejections
  page.on('pageerror', err => {
    console.log(`🔥 PAGE ERROR: ${err.message}`);
  });
  
  console.log('📱 Opening React app...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  
  console.log('⏱️  Waiting 10 seconds for errors to appear...');
  await page.waitForTimeout(10000);
  
  console.log('🔍 Checking for Settings link...');
  try {
    await page.click('a[href*="settings"], button:has-text("Nastavení"), [data-testid*="settings"]');
    console.log('⚙️ Clicked settings');
    await page.waitForTimeout(3000);
  } catch (e) {
    console.log('❌ Could not find settings link');
  }
  
  console.log('🏁 Debug session complete. Browser will stay open.');
})();