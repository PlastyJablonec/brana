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
    console.log('Camera Index Proxy: Fetching camera photo...');
    
    // Build the camera URL with current timestamp and cache buster  
    const timestamp = Date.now();
    const cacheBuster = Math.random();
    const photoUrl = `http://89.24.76.191:10180/photo.jpg?t=${timestamp}&cache=${cacheBuster}`;
    
    console.log('Camera Index Proxy: Requesting:', photoUrl);

    // KRITICKÁ OPRAVA: Kratší timeout + AbortController
    let abortController;
    let timeoutId;
    
    if (typeof AbortSignal?.timeout === 'function') {
      abortController = { signal: AbortSignal.timeout(3000) }; // 3s pro photo
    } else {
      abortController = new AbortController();
      timeoutId = setTimeout(() => {
        abortController.abort();
        console.log('Camera Index Proxy: Request aborted due to timeout');
      }, 3000);
    }

    // Fetch the photo from the camera
    const response = await fetch(photoUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Camera-Index-Proxy/1.0',
        'Accept': 'image/jpeg,image/*,*/*'
      },
      signal: abortController.signal
    });

    // Clear timeout if successful
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      console.error('Camera Index Proxy: Camera request failed:', response.status, response.statusText);
      res.status(response.status).json({ 
        error: 'Camera photo not available', 
        status: response.status,
        statusText: response.statusText
      });
      return;
    }

    // Get the photo data
    const imageBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(imageBuffer);

    console.log('Camera Index Proxy: Photo fetched successfully, size:', buffer.length, 'bytes');

    // Set appropriate headers for photo response
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Send the photo
    res.status(200).send(buffer);

  } catch (error) {
    console.error('Camera Index Proxy: Error fetching photo:', error);
    
    if (error.name === 'TimeoutError') {
      res.status(408).json({ error: 'Camera photo timeout' });
    } else {
      res.status(500).json({ error: 'Camera index proxy error', details: error.message });
    }
  }
}