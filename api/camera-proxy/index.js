export default async function handler(req, res) {
  console.log('📸 Camera Index Proxy: OPRAVENO - VRÁCENO K PHOTO.JPG (lepší kvalita!)');
  
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
    console.log('📷 Camera Index Proxy: Fetching PHOTO.JPG for better quality...');
    
    // ✅ FUNGUJÍCÍ HTTP PHOTO ENDPOINT - lepší kvalita než video stream!
    const timestamp = Date.now();
    const cacheBuster = Math.random();
    const photoUrl = `http://89.24.76.191:10180/photo.jpg?t=${timestamp}&cache=${cacheBuster}`;
    
    console.log('🎯 Camera Index Proxy: Fetching photo from:', photoUrl);

    // Fetch photo a proxy data (NEredirect!) - rychlejší timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout - rychlejší response
    
    const response = await fetch(photoUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Camera-Quality-Proxy/2.0',
        'Accept': 'image/jpeg,image/*,*/*'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    // Proxy image data místo redirect!
    const imageBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(imageBuffer);
    
    console.log(`✅ Camera Index Proxy: Photo loaded, size: ${buffer.length} bytes`);
    
    // Set proper image headers
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Send actual image data!
    res.status(200).send(buffer);

  } catch (error) {
    console.error('❌ Camera Index Proxy: Photo fetch failed:', error.message);
    
    if (error.name === 'AbortError') {
      res.status(408).json({ error: 'Photo timeout', details: 'Camera photo request timed out' });
    } else {
      res.status(500).json({ 
        error: 'Camera photo proxy failed', 
        details: error.message,
        endpoint: 'http://89.24.76.191:10180/photo.jpg'
      });
    }
  }
}