export default async function handler(req, res) {
  console.log('🎥 Camera Video Proxy: OPRAVENÁ VERZE - používá fungující HTTP video stream!');
  
  // Enable CORS pro všechny domény
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    console.log('🚀 PERFEKT! Proxy směruje na fungující video stream!');
    
    // ✅ FUNGUJÍCÍ HTTP VIDEO STREAM - verified by Python diagnostics!
    const timestamp = Date.now();
    const cameraUrl = `http://89.24.76.191:10180/video?t=${timestamp}&proxy=vercel`;
    
    console.log('🎯 Redirecting to working video stream:', cameraUrl);
    
    // Pro HTTPS aplikace: redirect na fungující HTTP video stream
    // Browser bude mít Mixed Content warning, ale uživatel může povolit
    res.redirect(302, cameraUrl);
    
  } catch (error) {
    console.error('❌ Camera Video Proxy: Redirect error:', error);
    res.status(500).json({ 
      error: 'Camera video proxy failed', 
      details: error.message,
      suggestion: 'Try direct HTTP endpoint: http://89.24.76.191:10180/video'
    });
  }
}