export default async function handler(req, res) {
  console.log('🎥 Camera Index Proxy: OPRAVENO - POUŽÍVÁ FUNGUJÍCÍ VIDEO STREAM!');
  
  // Enable CORS
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
    console.log('🚀 Camera Index Proxy: Redirecting to WORKING VIDEO STREAM instead of photo!');
    
    // ✅ FUNGUJÍCÍ HTTP VIDEO STREAM - Python diagnostic script verified this works!
    const timestamp = Date.now();
    const cacheBuster = Math.random();
    const videoUrl = `http://89.24.76.191:10180/video?t=${timestamp}&cache=${cacheBuster}&proxy=index`;
    
    console.log('🎯 Camera Index Proxy: Redirecting to working video stream:', videoUrl);

    // Redirect browser na fungující video stream místo photo.jpg 
    // Browser bude mít Mixed Content warning, ale video funguje!
    res.redirect(302, videoUrl);

  } catch (error) {
    console.error('❌ Camera Index Proxy: Video redirect failed:', error);
    res.status(500).json({ 
      error: 'Camera index proxy failed', 
      details: error.message,
      suggestion: 'Try direct HTTP endpoint: http://89.24.76.191:10180/video'
    });
  }
}