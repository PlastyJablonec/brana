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
    console.log('Camera Proxy: Fetching camera image...');
    
    // Build the camera URL with current timestamp and cache buster
    const timestamp = Date.now();
    const cacheBuster = Math.random();
    // Zkus video endpoint první, pak photo.jpg jako fallback
    const videoUrl = `http://89.24.76.191:10180/video?t=${timestamp}&cache=${cacheBuster}`;
    const photoUrl = `http://89.24.76.191:10180/photo.jpg?t=${timestamp}&cache=${cacheBuster}`;
    
    let cameraUrl = videoUrl; // Zkus video první
    
    console.log('Camera Proxy: Requesting:', cameraUrl);

    // KRITICKÁ OPRAVA: Kratší timeout + AbortController fallback
    let abortController;
    let timeoutId;
    
    if (typeof AbortSignal?.timeout === 'function') {
      // Moderní prohlížeče
      abortController = { signal: AbortSignal.timeout(5000) }; // 5s místo 10s
    } else {
      // Fallback pro starší prostředí
      abortController = new AbortController();
      timeoutId = setTimeout(() => {
        abortController.abort();
        console.log('Camera Proxy: Request aborted due to timeout');
      }, 5000);
    }

    // Fetch the image/stream from the camera
    let response = await fetch(cameraUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Camera-Proxy/1.0',
        'Accept': 'multipart/x-mixed-replace,video/*,image/jpeg,image/*,*/*'
      },
      signal: abortController.signal
    });

    // Pokud video selže, zkus photo.jpg fallback
    if (!response.ok && cameraUrl === videoUrl) {
      console.log('Camera Proxy: Video failed, trying photo.jpg fallback...');
      cameraUrl = photoUrl;
      
      response = await fetch(cameraUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Camera-Proxy/1.0',
          'Accept': 'image/jpeg,image/*,*/*'
        },
        signal: abortController.signal
      });
    }

    // Clear timeout if successful
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      console.error('Camera Proxy: Camera request failed:', response.status, response.statusText);
      res.status(response.status).json({ 
        error: 'Camera not available', 
        status: response.status,
        statusText: response.statusText
      });
      return;
    }

    // Get the image data
    const imageBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(imageBuffer);

    console.log('Camera Proxy: Image fetched successfully, size:', buffer.length, 'bytes');

    // Set appropriate headers for image response
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Send the image
    res.status(200).send(buffer);

  } catch (error) {
    console.error('Camera Proxy: Error fetching camera image:', error);
    
    if (error.name === 'TimeoutError') {
      res.status(408).json({ error: 'Camera timeout' });
    } else {
      res.status(500).json({ error: 'Camera proxy error', details: error.message });
    }
  }
}