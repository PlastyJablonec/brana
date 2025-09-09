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
    console.log('Camera Video Proxy: Fetching MJPEG stream...');
    
    // Build the camera URL with current timestamp and cache buster
    const timestamp = Date.now();
    const cacheBuster = Math.random();
    const cameraUrl = `http://89.24.76.191:10180/video?t=${timestamp}&cache=${cacheBuster}`;
    
    console.log('Camera Video Proxy: Requesting:', cameraUrl);

    // KRITICKÁ OPRAVA: AbortController s timeout (Vercel compatible)
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
      console.log('Camera Video Proxy: Request aborted due to timeout');
    }, 8000); // 8s timeout pro video stream

    // Fetch the video stream from the camera
    const response = await fetch(cameraUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Camera-Video-Proxy/1.0',
        'Accept': 'multipart/x-mixed-replace,video/*,image/*,*/*'
      },
      signal: abortController.signal
    });

    // Clear timeout if successful
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('Camera Video Proxy: Camera request failed:', response.status, response.statusText);
      res.status(response.status).json({ 
        error: 'Camera video stream not available', 
        status: response.status,
        statusText: response.statusText
      });
      return;
    }

    // Check content type
    const contentType = response.headers.get('content-type');
    console.log('Camera Video Proxy: Content-Type:', contentType);

    // Pokud je to MJPEG stream, forward přímo
    if (contentType && (contentType.includes('multipart/x-mixed-replace') || contentType.includes('video/'))) {
      console.log('Camera Video Proxy: Forwarding MJPEG stream');
      
      // Set appropriate headers for MJPEG stream
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      // Forward the stream
      response.body.pipe(res);
      return;
    }

    // Jinak zpracuj jako statický obrázek
    const imageBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(imageBuffer);

    console.log('Camera Video Proxy: Static image fetched, size:', buffer.length, 'bytes');

    // Set appropriate headers for image response
    res.setHeader('Content-Type', contentType || 'image/jpeg');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Send the image
    res.status(200).send(buffer);

  } catch (error) {
    console.error('Camera Video Proxy: Error fetching video stream:', error);
    
    if (error.name === 'TimeoutError') {
      res.status(408).json({ error: 'Camera video timeout' });
    } else {
      res.status(500).json({ error: 'Camera video proxy error', details: error.message });
    }
  }
}