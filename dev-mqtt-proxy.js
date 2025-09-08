const express = require('express');
const mqtt = require('mqtt');
const app = express();

app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
});

// Global MQTT client to maintain connection
let mqttClient = null;
let isConnecting = false;
let lastMessages = {
  'IoT/Brana/Status': null,
  'IoT/Brana/Status2': null,
  'Log/Brana/ID': null
};

function connectToMqtt() {
  if (mqttClient && mqttClient.connected) {
    return mqttClient;
  }

  if (isConnecting) {
    return mqttClient;
  }

  isConnecting = true;
  console.log('DEV MQTT Proxy: Attempting to connect to ws://89.24.76.191:9001');
  
  try {
    mqttClient = mqtt.connect('ws://89.24.76.191:9001', {
      clientId: `dev-proxy-${Math.random().toString(16).substring(2, 8)}`,
      clean: false,
      reconnectPeriod: 5000,
      connectTimeout: 15000,
      keepalive: 60
    });

    mqttClient.on('connect', () => {
      console.log('DEV MQTT Proxy: ✅ Connected to broker successfully');
      isConnecting = false;
      
      mqttClient.subscribe(['IoT/Brana/Status', 'IoT/Brana/Status2', 'Log/Brana/ID'], { qos: 1 }, (err) => {
        if (err) {
          console.error('DEV MQTT Proxy: Subscribe error:', err);
        } else {
          console.log('DEV MQTT Proxy: ✅ Subscribed to status topics and activity log');
        }
      });
    });

    mqttClient.on('message', (topic, message) => {
      const messageStr = message.toString();
      console.log(`DEV MQTT Proxy: 📨 Message received: ${topic} = ${messageStr}`);
      lastMessages[topic] = messageStr;
    });

    mqttClient.on('error', (error) => {
      console.error('DEV MQTT Proxy: ❌ Connection error:', error);
      isConnecting = false;
    });

    mqttClient.on('close', () => {
      console.log('DEV MQTT Proxy: 🔌 Connection closed');
      isConnecting = false;
    });

  } catch (error) {
    console.error('DEV MQTT Proxy: ❌ Setup error:', error);
    isConnecting = false;
  }

  return mqttClient;
}

// API endpoints
app.get('/api/mqtt-proxy', (req, res) => {
  const client = connectToMqtt();
  
  if (!client) {
    res.status(503).json({ 
      connected: false, 
      error: 'MQTT client not initialized',
      messages: lastMessages
    });
    return;
  }

  res.json({ 
    connected: client.connected,
    status: 'DEV MQTT Proxy Active',
    clientId: client.options?.clientId,
    messages: lastMessages,
    isConnecting: isConnecting
  });
});

app.post('/api/mqtt-proxy', (req, res) => {
  const client = connectToMqtt();
  const { topic, message } = req.body;
  
  if (!client) {
    res.status(503).json({ error: 'MQTT client not initialized' });
    return;
  }

  console.log(`DEV MQTT Proxy: Publishing to ${topic}: ${message} (connected: ${client.connected})`);
  
  client.publish(topic, message, { qos: 1 }, (err) => {
    if (err) {
      console.error('DEV MQTT Proxy: Publish error:', err);
      res.status(500).json({ error: 'Publish failed', details: err.message });
    } else {
      console.log(`DEV MQTT Proxy: ✅ Successfully published to ${topic}: ${message}`);
      res.json({ success: true, topic, message, connected: client.connected });
    }
  });
});

// Camera proxy endpoints - same logic as production api/camera-proxy.js
app.get('/api/camera-proxy', async (req, res) => {
  try {
    console.log('DEV Camera Proxy: Fetching camera image...');
    
    // Build the camera URL with current timestamp and cache buster
    const timestamp = Date.now();
    const cacheBuster = Math.random();
    // Try photo.jpg first (single frame), then video as fallback
    const photoUrl = `http://89.24.76.191:10180/photo.jpg?t=${timestamp}&cache=${cacheBuster}`;
    const videoUrl = `http://89.24.76.191:10180/video?t=${timestamp}&cache=${cacheBuster}`;
    
    let cameraUrl = photoUrl; // Try photo first (single image)
    
    console.log('DEV Camera Proxy: Requesting:', cameraUrl);

    // CRITICAL FIX: Shorter timeout + AbortController fallback
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
      console.log('DEV Camera Proxy: Request aborted due to timeout');
    }, 5000);

    // Fetch the image/stream from the camera
    let response = await fetch(cameraUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'DEV-Camera-Proxy/1.0',
        'Accept': 'multipart/x-mixed-replace,video/*,image/jpeg,image/*,*/*'
      },
      signal: abortController.signal
    });

    // If photo fails, try video fallback
    if (!response.ok && cameraUrl === photoUrl) {
      console.log('DEV Camera Proxy: Photo failed, trying video fallback...');
      cameraUrl = videoUrl;
      
      response = await fetch(cameraUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'DEV-Camera-Proxy/1.0',
          'Accept': 'image/jpeg,image/*,*/*'
        },
        signal: abortController.signal
      });
    }

    // Clear timeout if successful
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('DEV Camera Proxy: Camera request failed:', response.status, response.statusText);
      res.status(response.status).json({ 
        error: 'Camera not available', 
        status: response.status,
        statusText: response.statusText
      });
      return;
    }

    // Get the image data
    const imageBuffer = Buffer.from(await response.arrayBuffer());

    console.log('DEV Camera Proxy: Image fetched successfully, size:', imageBuffer.length, 'bytes');

    // Set appropriate headers for image response
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', imageBuffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Send the image
    res.status(200).send(imageBuffer);

  } catch (error) {
    console.error('DEV Camera Proxy: Error fetching camera image:', error);
    
    if (error.name === 'AbortError') {
      res.status(408).json({ error: 'Camera timeout' });
    } else {
      res.status(500).json({ error: 'Camera proxy error', details: error.message });
    }
  }
});

// Camera video endpoint fallback
app.get('/api/camera-proxy/video', async (req, res) => {
  // Same logic as main camera-proxy but force video endpoint
  try {
    console.log('DEV Camera Proxy: Fetching camera video...');
    
    const timestamp = Date.now();
    const cacheBuster = Math.random();
    const videoUrl = `http://89.24.76.191:10180/video?t=${timestamp}&cache=${cacheBuster}`;
    
    console.log('DEV Camera Proxy: Requesting video:', videoUrl);

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
      console.log('DEV Camera Proxy: Video request aborted due to timeout');
    }, 5000);

    const response = await fetch(videoUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'DEV-Camera-Proxy/1.0',
        'Accept': 'multipart/x-mixed-replace,video/*,image/jpeg,image/*,*/*'
      },
      signal: abortController.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('DEV Camera Proxy: Video request failed:', response.status, response.statusText);
      res.status(response.status).json({ 
        error: 'Camera video not available', 
        status: response.status,
        statusText: response.statusText
      });
      return;
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());
    console.log('DEV Camera Proxy: Video fetched successfully, size:', imageBuffer.length, 'bytes');

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', imageBuffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.status(200).send(imageBuffer);

  } catch (error) {
    console.error('DEV Camera Proxy: Error fetching camera video:', error);
    
    if (error.name === 'AbortError') {
      res.status(408).json({ error: 'Camera video timeout' });
    } else {
      res.status(500).json({ error: 'Camera video proxy error', details: error.message });
    }
  }
});

const PORT = 3003;
app.listen(PORT, () => {
  console.log(`🚀 DEV MQTT + Camera Proxy server running on http://localhost:${PORT}`);
  console.log('📡 Connecting to MQTT broker...');
  console.log('📸 Camera proxy endpoints available: /api/camera-proxy, /api/camera-proxy/video');
  connectToMqtt();
});