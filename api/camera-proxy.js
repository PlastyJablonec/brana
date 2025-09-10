// Vercel Serverless Function - API proxy pro HTTP kameru
// Řeší Mixed Content problém - HTTPS stránka přistupuje k HTTP kameře

export default async function handler(req, res) {
  // CORS headers pro cross-origin requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Only allow GET requests
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  
  // Preserve query parameters for cache busting (t, cache)
  const url = new URL('http://89.24.76.191:10180/photo.jpg');
  
  // Forward timestamp and cache parameters from client
  if (req.query.t) url.searchParams.set('t', req.query.t);
  if (req.query.cache) url.searchParams.set('cache', req.query.cache);
  
  const CAMERA_URL = url.toString();
  
  try {
    console.log('📹 Camera Proxy: Fetching image from', CAMERA_URL);
    
    // Fetch image from HTTP camera with shorter timeout for faster response
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout instead of 10s
    
    const response = await fetch(CAMERA_URL, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Vercel-Camera-Proxy/1.0',
        'Connection': 'close' // Avoid connection pooling issues
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error('❌ Camera Proxy: HTTP error', response.status, response.statusText);
      res.status(502).json({ 
        error: 'Camera not available', 
        details: `HTTP ${response.status}` 
      });
      return;
    }
    
    // Get image data as ArrayBuffer
    const imageBuffer = await response.arrayBuffer();
    const imageBytes = Buffer.from(imageBuffer);
    
    console.log('✅ Camera Proxy: Image fetched successfully,', imageBytes.length, 'bytes');
    
    // Set appropriate headers for fast response
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', imageBytes.length);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Served-By', 'vercel-proxy'); // Debug header
    
    // Send image data
    res.status(200).send(imageBytes);
    
  } catch (error) {
    console.error('❌ Camera Proxy: Error fetching image:', error.message);
    
    if (error.name === 'AbortError') {
      res.status(504).json({ error: 'Camera timeout (3s)' });
    } else {
      res.status(500).json({ 
        error: 'Camera proxy error',
        details: error.message 
      });
    }
  }
}