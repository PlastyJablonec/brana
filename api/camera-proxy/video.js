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

    // VERCEL SERVERLESS FIX: Jednodušší implementace bez streaming
    // Pro Vercel Edge Functions je lepší načíst data a vrátit je jako buffer
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
      console.log('Camera Video Proxy: Request aborted due to timeout');
    }, 5000); // Kratší timeout pro serverless

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

    // Get content type
    const contentType = response.headers.get('content-type');
    console.log('Camera Video Proxy: Content-Type:', contentType);

    // VERCEL FIX: Místo pipe() použij arrayBuffer pro větší kompatibilitu
    const streamBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(streamBuffer);
    
    console.log('Camera Video Proxy: Stream buffer fetched, size:', buffer.length, 'bytes');

    // Set appropriate headers for MJPEG stream
    res.setHeader('Content-Type', contentType || 'multipart/x-mixed-replace; boundary=Ba4oTvQMY8ew04N8dcnM');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Send the stream data
    res.status(200).send(buffer);

  } catch (error) {
    console.error('Camera Video Proxy: Error fetching video stream:', error);
    
    if (error.name === 'AbortError') {
      res.status(408).json({ error: 'Camera video timeout' });
    } else {
      res.status(500).json({ error: 'Camera video proxy error', details: error.message });
    }
  }
}