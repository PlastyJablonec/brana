export default async function handler(req, res) {
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
    console.log('Camera Video Proxy: EMERGENCY REDIRECT SOLUTION');
    
    // NOUZOVÉ ŘEŠENÍ: Direct redirect na fungující HTTP endpoint
    // Vercel serverless má problém s MJPEG streaming, použij redirect
    const timestamp = Date.now();
    const cameraUrl = `http://89.24.76.191:10180/video?t=${timestamp}`;
    
    console.log('Camera Video Proxy: Redirecting to:', cameraUrl);
    
    // Redirect browser na přímý endpoint (funguje jen pro HTTP dev)
    res.redirect(302, cameraUrl);
    
  } catch (error) {
    console.error('Camera Video Proxy: Redirect error:', error);
    res.status(500).json({ error: 'Camera video proxy error', details: error.message });
  }
}